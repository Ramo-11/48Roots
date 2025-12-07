const Cart = require('../../models/Cart');
const Order = require('../../models/Order');
const Settings = require('../../models/Settings');
const { logger } = require('../utils/logger');
const { createPaymentIntent, retrievePaymentIntent } = require('../config/stripe');
const { createPrintfulOrder, calculatePrintfulShipping } = require('../config/printful');

/**
 * Fallback shipping rules when not using Printful
 */
function calculateRegionBasedShipping(subtotal, country) {
    const rules = {
        US: { cost: 4.99, free: 75 },
        CA: { cost: 6.99, free: 100 },
        GB: { cost: 6.99, free: 100 },
        UK: { cost: 6.99, free: 100 },
        DE: { cost: 7.99, free: 100 },
        AU: { cost: 7.99, free: 100 },
    };

    const region = rules[country] || rules['US']; // Default: US pricing

    if (subtotal >= region.free) {
        return 0;
    }

    return region.cost;
}

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
 * Calculate shipping using STATIC region-based rules
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

        const subtotal = cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

        // Static shipping rules by region
        const shippingRules = {
            US: { cost: 4.99, freeThreshold: 75 },
            CA: { cost: 6.99, freeThreshold: 100 },
            GB: { cost: 6.99, freeThreshold: 100 },
            UK: { cost: 6.99, freeThreshold: 100 }, // alias
            DE: { cost: 7.99, freeThreshold: 100 },
            AU: { cost: 7.99, freeThreshold: 100 },
        };

        const country = (address.country || 'US').toUpperCase();
        const region = shippingRules[country] || shippingRules['US'];

        let shippingCost = region.cost;

        // Free shipping threshold
        if (subtotal >= region.freeThreshold) {
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
        logger.error('Error calculating static shipping:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to calculate shipping',
        });
    }
};

/**
 * Confirm and process an order
 */
exports.confirmOrder = async (req, res) => {
    try {
        const { paymentIntentId, shippingAddress, customer } = req.body;
        const sessionId = req.session.id;

        // Verify payment via Stripe
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

        // Calculate subtotal
        const subtotal = cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

        // STATIC SHIPPING RULES
        const shippingRules = {
            US: { cost: 4.99, freeThreshold: 75 },
            CA: { cost: 6.99, freeThreshold: 100 },
            GB: { cost: 6.99, freeThreshold: 100 },
            UK: { cost: 6.99, freeThreshold: 100 },
            DE: { cost: 7.99, freeThreshold: 100 },
            AU: { cost: 7.99, freeThreshold: 100 },
        };

        const country = (shippingAddress.country || 'US').toUpperCase();
        const region = shippingRules[country] || shippingRules['US'];

        let shippingCost = region.cost;
        if (subtotal >= region.freeThreshold) {
            shippingCost = 0;
        }

        // Donation amount
        const donationAmount = (await Settings.get('donation_per_purchase')) || 5.0;

        // Create order in our DB
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

        // Build Printful items
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

        // If Printful items exist → create order in Printful
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
            } else {
                order.notes = `Printful order creation failed: ${printfulResult.error}`;
                await order.save();
            }
        } else {
            // Non-Printful order → manual fulfillment
            order.notes = 'No Printful products - manual fulfillment required';
            await order.save();
        }

        // Clear cart
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
