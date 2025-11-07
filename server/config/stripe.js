const stripe = require('stripe')(
    process.env.NODE_ENV === 'production'
        ? process.env.STRIPE_SECRET_KEY_PROD
        : process.env.STRIPE_SECRET_KEY_TEST
);
const { logger } = require('../utils/logger');

const createPaymentIntent = async (amount, options = {}) => {
    try {
        const paymentIntent = await stripe.paymentIntents.create({
            amount,
            currency: 'usd',
            automatic_payment_methods: {
                enabled: true,
            },
            ...options,
        });

        return paymentIntent;
    } catch (error) {
        logger.error('Stripe payment intent creation failed:', error);
        throw error;
    }
};

const retrievePaymentIntent = async (paymentIntentId) => {
    try {
        return await stripe.paymentIntents.retrieve(paymentIntentId);
    } catch (error) {
        logger.error('Stripe payment intent retrieval failed:', error);
        throw error;
    }
};

const createRefund = async (paymentIntentId, amount) => {
    try {
        return await stripe.refunds.create({
            payment_intent: paymentIntentId,
            amount,
        });
    } catch (error) {
        logger.error('Stripe refund failed:', error);
        throw error;
    }
};

module.exports = {
    createPaymentIntent,
    retrievePaymentIntent,
    createRefund,
};
