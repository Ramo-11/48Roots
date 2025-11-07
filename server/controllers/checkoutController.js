const Cart = require('../../models/Cart');
const Order = require('../../models/Order');
const Settings = require('../../models/Settings');
const { logger } = require('../utils/logger');
const { createPaymentIntent, retrievePaymentIntent } = require('../config/stripe');
const { createPrintifyOrder, calculatePrintifyShipping } = require('../config/printify');

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

        // Try Printify shipping calculation
        try {
            if (process.env.PRINTIFY_API_TOKEN && process.env.PRINTIFY_SHOP_ID) {
                shippingCost = await calculatePrintifyShipping(cart.items, address);
            }
        } catch (error) {
            logger.error('Printify shipping calculation failed, using fallback:', error);
        }

        // Fallback to flat rate if Printify fails
        if (shippingCost === 0) {
            const flatRate = (await Settings.get('shipping_flat_rate')) || 5.99;
            shippingCost = flatRate;
        }

        res.json({
            success: true,
            data: {
                shipping: shippingCost,
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

exports.confirmOrder = async (req, res) => {
    try {
        const { paymentIntentId, shippingAddress, customer } = req.body;
        const sessionId = req.session.id;

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

        const subtotal = cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const shippingCost = await calculatePrintifyShipping(cart.items, shippingAddress);
        const donationAmount = (await Settings.get('donation_per_purchase')) || 5.0;

        const order = await Order.create({
            customer,
            shippingAddress,
            items: cart.items.map((item) => ({
                product: item.product._id,
                productSnapshot: {
                    name: item.product.name,
                    slug: item.product.slug,
                    image: item.product.images[0]?.url,
                },
                variant: item.variant,
                quantity: item.quantity,
                price: item.price,
                subtotal: item.price * item.quantity,
            })),
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

        const printifyResult = await createPrintifyOrder({
            orderNumber: order.orderNumber,
            items: cart.items,
            shippingAddress,
            customer,
        });

        if (printifyResult.success) {
            order.fulfillment.printifyOrderId = printifyResult.printifyOrderId;
            await order.save();
        } else {
            logger.error('Printify order creation failed, but order was saved:', order.orderNumber);
        }

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
