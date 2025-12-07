// services/stripeService.js
const { logger } = require('../utils/logger');

// Load correct key based on environment
const stripe = require('stripe')(
    process.env.NODE_ENV === 'production'
        ? process.env.STRIPE_SECRET_KEY_PROD
        : process.env.STRIPE_SECRET_KEY_TEST
);

/* ============================================================
   CREATE PAYMENT INTENT
============================================================ */
const createPaymentIntent = async (amount, options = {}) => {
    try {
        const paymentIntent = await stripe.paymentIntents.create({
            amount,
            currency: 'usd',
            automatic_payment_methods: { enabled: true },
            ...options, // allows metadata or customer info
        });

        return paymentIntent;
    } catch (error) {
        logger.error('Stripe payment intent creation failed:', error.message);
        throw error;
    }
};

/* ============================================================
   RETRIEVE PAYMENT INTENT
============================================================ */
const retrievePaymentIntent = async (paymentIntentId) => {
    try {
        return await stripe.paymentIntents.retrieve(paymentIntentId);
    } catch (error) {
        logger.error('Stripe payment intent retrieval failed:', error.message);
        throw error;
    }
};

/* ============================================================
   CREATE REFUND
============================================================ */
const createRefund = async (paymentIntentId, amount = null) => {
    try {
        const refundData = { payment_intent: paymentIntentId };
        if (amount) refundData.amount = amount;

        return await stripe.refunds.create(refundData);
    } catch (error) {
        logger.error('Stripe refund failed:', error.message);
        throw error;
    }
};

/* ============================================================
   EXPORTS
============================================================ */
module.exports = {
    stripe,
    createPaymentIntent,
    retrievePaymentIntent,
    createRefund,
};
