const Cart = require('../../models/Cart');
const Order = require('../../models/Order');
const Settings = require('../../models/Settings');
const { logger } = require('../utils/logger');
const { createPaymentIntent, retrievePaymentIntent } = require('../config/stripe');
const { createPrintfulOrder, calculatePrintfulShipping } = require('../config/printful');

/**
 * Create a checkout session with Stripe payment intent
 */
exports.createCheckoutSession = async (req, res) => {
    try {
        const sessionId = req.session.id;

        if (!sessionId) {
            return res.status(400).json({
                success: false,
                message: 'No active cart session',
            });
        }

        const cart = await Cart.findOne({ sessionId }).populate('items.product');

        if (!cart || !cart.items.length) {
            return res.status(400).json({
                success: false,
                message: 'Cart is empty',
            });
        }

        const subtotal = cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

        const paymentIntent = await createPaymentIntent(Math.round(subtotal * 100));

        res.json({
            success: true,
            data: {
                clientSecret: paymentIntent.client_secret,
                amount: subtotal,
            },
        });
    } catch (error) {
        logger.error('Error creating checkout session:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create checkout session',
        });
    }
};

/**
 * Calculate shipping costs using Printful API
 */
exports.calculateShipping = async (req, res) => {
    try {
        const { address } = req.body;
        const sessionId = req.session.id;

        if (!sessionId) {
            return res.status(400).json({
                success: false,
                message: 'No active session',
            });
        }

        const cart = await Cart.findOne({ sessionId }).populate('items.product');

        if (!cart || !cart.items.length) {
            return res.status(400).json({
                success: false,
                message: 'Cart is empty',
            });
        }

        let shippingCost = 0;

        // Prepare items for Printful shipping calculation
        const printfulItems = cart.items
            .map((item) => {
                // Get the Printful variant ID from the product
                const variant = item.product.variants?.find((v) => v.size === item.variant.size);

                if (variant?.printfulVariantId || variant?.printfulSyncVariantId) {
                    return {
                        printfulVariantId: variant.printfulVariantId,
                        printfulSyncVariantId: variant.printfulSyncVariantId,
                        quantity: item.quantity,
                    };
                }
                return null;
            })
            .filter(Boolean);

        // Try Printful shipping calculation if we have Printful products
        if (printfulItems.length > 0 && process.env.PRINTFUL_API_TOKEN) {
            try {
                shippingCost = await calculatePrintfulShipping(printfulItems, {
                    line1: address.line1 || address.address1,
                    city: address.city,
                    state: address.state,
                    postalCode: address.postalCode || address.zip,
                    country: address.country || 'US',
                });
            } catch (printfulError) {
                logger.error(
                    'Printful shipping calculation failed, using fallback:',
                    printfulError
                );
            }
        }

        // Fallback to flat rate if Printful fails or no Printful products
        if (shippingCost === 0) {
            const flatRate = (await Settings.get('shipping_flat_rate')) || 5.99;
            shippingCost = flatRate;
        }

        // Check for free shipping threshold
        const subtotal = cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const freeShippingThreshold = await Settings.get('free_shipping_threshold');

        if (freeShippingThreshold && subtotal >= freeShippingThreshold) {
            shippingCost = 0;
        }

        res.json({
            success: true,
            data: {
                shipping: shippingCost,
                isFreeShipping: shippingCost === 0,
            },
        });
    } catch (error) {
        logger.error('Error calculating shipping:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to calculate shipping',
        });
    }
};

/**
 * Confirm and process the order
 */
exports.confirmOrder = async (req, res) => {
    try {
        const { paymentIntentId, shippingAddress, customer } = req.body;
        const sessionId = req.session.id;

        // Verify payment
        const paymentIntent = await retrievePaymentIntent(paymentIntentId);

        if (paymentIntent.status !== 'succeeded') {
            return res.status(400).json({
                success: false,
                message: 'Payment not completed',
            });
        }

        const cart = await Cart.findOne({ sessionId }).populate('items.product');

        if (!cart || !cart.items.length) {
            return res.status(400).json({
                success: false,
                message: 'Cart is empty',
            });
        }

        // Calculate totals
        const subtotal = cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

        // Get shipping cost
        let shippingCost = 0;
        const printfulItems = cart.items
            .map((item) => {
                const variant = item.product.variants?.find((v) => v.size === item.variant.size);
                if (variant?.printfulVariantId || variant?.printfulSyncVariantId) {
                    return {
                        printfulVariantId: variant.printfulVariantId,
                        printfulSyncVariantId: variant.printfulSyncVariantId,
                        quantity: item.quantity,
                    };
                }
                return null;
            })
            .filter(Boolean);

        if (printfulItems.length > 0) {
            shippingCost = await calculatePrintfulShipping(printfulItems, shippingAddress);
        }

        if (shippingCost === 0) {
            shippingCost = (await Settings.get('shipping_flat_rate')) || 5.99;
        }

        // Check free shipping
        const freeShippingThreshold = await Settings.get('free_shipping_threshold');
        if (freeShippingThreshold && subtotal >= freeShippingThreshold) {
            shippingCost = 0;
        }

        const donationAmount = (await Settings.get('donation_per_purchase')) || 5.0;

        // Create the order in our database
        const order = await Order.create({
            customer,
            shippingAddress,
            items: cart.items.map((item) => {
                const variant = item.product.variants?.find((v) => v.size === item.variant.size);
                return {
                    product: item.product._id,
                    productSnapshot: {
                        name: item.product.name,
                        slug: item.product.slug,
                        image: item.product.images[0]?.url,
                    },
                    variant: {
                        size: item.variant.size,
                        color: item.variant.color || '',
                        sku: variant?.sku || '',
                        printfulVariantId: variant?.printfulVariantId,
                        printfulSyncVariantId: variant?.printfulSyncVariantId,
                    },
                    quantity: item.quantity,
                    price: item.price,
                    subtotal: item.price * item.quantity,
                };
            }),
            subtotal,
            shipping: { cost: shippingCost, method: 'Standard' },
            donation: { amount: donationAmount, description: 'Palestine relief donation' },
            total: subtotal + shippingCost,
            payment: {
                method: 'stripe',
                stripePaymentIntentId: paymentIntentId,
                status: 'completed',
                paidAt: new Date(),
            },
            metadata: {
                ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
                userAgent: req.headers['user-agent'],
            },
        });

        // Create order in Printful
        const printfulOrderItems = cart.items
            .map((item) => {
                const variant = item.product.variants?.find((v) => v.size === item.variant.size);

                if (variant?.printfulSyncVariantId || variant?.printfulVariantId) {
                    return {
                        product: item.product,
                        variant: {
                            printfulSyncVariantId: variant.printfulSyncVariantId,
                            printfulVariantId: variant.printfulVariantId,
                        },
                        quantity: item.quantity,
                        printFiles: item.product.printFiles,
                    };
                }
                return null;
            })
            .filter(Boolean);

        if (printfulOrderItems.length > 0) {
            const printfulResult = await createPrintfulOrder({
                orderNumber: order.orderNumber,
                items: printfulOrderItems,
                shippingAddress,
                customer,
                subtotal,
                shippingCost,
            });

            if (printfulResult.success) {
                order.fulfillment.printfulOrderId = printfulResult.printfulOrderId;
                order.fulfillment.status = 'processing';
                await order.save();
                logger.info(
                    `Printful order created for ${order.orderNumber}: ${printfulResult.printfulOrderId}`
                );
            } else {
                logger.error(
                    `Printful order creation failed for ${order.orderNumber}:`,
                    printfulResult.error
                );
                // Order is still saved, can be manually processed later
                order.notes = `Printful order creation failed: ${printfulResult.error}`;
                await order.save();
            }
        } else {
            logger.warn(
                `No Printful items in order ${order.orderNumber} - manual fulfillment required`
            );
            order.notes = 'No Printful products - manual fulfillment required';
            await order.save();
        }

        // Clear the cart
        await Cart.deleteOne({ sessionId });

        res.json({
            success: true,
            data: {
                orderNumber: order.orderNumber,
                order,
            },
        });
    } catch (error) {
        logger.error('Error confirming order:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to confirm order',
        });
    }
};

/**
 * Get order details by order number
 */
exports.getOrderByNumber = async (req, res) => {
    try {
        const { orderNumber } = req.params;

        const order = await Order.findOne({ orderNumber }).populate('items.product');

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found',
            });
        }

        res.json({
            success: true,
            data: order,
        });
    } catch (error) {
        logger.error('Error getting order:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get order',
        });
    }
};
