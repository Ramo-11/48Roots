const Product = require('../../models/Product');
const Announcement = require('../../models/Announcement');
const { logger } = require('../utils/logger');

exports.getHome = async (req, res) => {
    try {
        res.render('index', {
            title: '48 Roots - Palestinian Heritage Apparel',
            description:
                'Shop authentic Palestinian-inspired clothing. Every purchase supports Palestine.',
            additionalCSS: ['index.css'],
            additionalJS: ['pages/index.js'],
            layout: 'layout',
        });
    } catch (error) {
        logger.error('Error rendering home page:', error);
        res.status(500).send('Server error');
    }
};

exports.getShop = async (req, res) => {
    try {
        res.render('shop', {
            title: 'Shop All - 48 Roots',
            description: 'Browse our complete collection of Palestinian-inspired apparel',
            additionalCSS: ['shop.css', 'index.css'],
            additionalJS: ['pages/shop.js'],
            layout: 'layout',
        });
    } catch (error) {
        logger.error('Error rendering shop page:', error);
        res.status(500).send('Server error');
    }
};

exports.getProductDetail = async (req, res) => {
    try {
        const { slug } = req.params;
        res.render('product-detail', {
            title: 'Product Details - 48 Roots',
            description: 'View product details and add to cart',
            additionalCSS: ['product-detail.css'],
            additionalJS: ['pages/product-detail.js'],
            layout: 'layout',
        });
    } catch (error) {
        logger.error('Error rendering product detail page:', error);
        res.status(500).send('Server error');
    }
};

exports.getNewArrivals = async (req, res) => {
    try {
        res.render('new-arrivals', {
            title: 'New Arrivals - 48 Roots',
            description: 'Check out our newest Palestinian-inspired designs',
            additionalCSS: ['shop.css', 'index.css'],
            additionalJS: ['pages/new-arrivals.js'],
            layout: 'layout',
        });
    } catch (error) {
        logger.error('Error rendering new arrivals page:', error);
        res.status(500).send('Server error');
    }
};

exports.getAbout = async (req, res) => {
    try {
        res.render('about', {
            title: 'Our Story - 48 Roots',
            description: 'Learn about 48 Roots and our mission to support Palestine',
            additionalCSS: ['about.css'],
            additionalJS: ['pages/about.js'],
            layout: 'layout',
        });
    } catch (error) {
        logger.error('Error rendering about page:', error);
        res.status(500).send('Server error');
    }
};

exports.getImpact = async (req, res) => {
    try {
        res.render('impact', {
            title: 'Our Impact - 48 Roots',
            description: 'See how your purchases are making a difference in Palestine',
            additionalCSS: ['impact.css'],
            additionalJS: ['pages/impact.js'],
            layout: 'layout',
        });
    } catch (error) {
        logger.error('Error rendering impact page:', error);
        res.status(500).send('Server error');
    }
};

exports.getContact = async (req, res) => {
    try {
        res.render('contact', {
            title: 'Contact Us - 48 Roots',
            description: 'Get in touch with the 48 Roots team',
            additionalCSS: ['contact.css'],
            additionalJS: ['pages/contact.js'],
            layout: 'layout',
        });
    } catch (error) {
        logger.error('Error rendering contact page:', error);
        res.status(500).send('Server error');
    }
};

exports.getCart = async (req, res) => {
    try {
        res.render('cart', {
            title: 'Shopping Cart - 48 Roots',
            description: 'Review your cart and proceed to checkout',
            additionalCSS: ['cart.css'],
            additionalJS: ['pages/cart.js'],
            layout: 'layout',
        });
    } catch (error) {
        logger.error('Error rendering cart page:', error);
        res.status(500).send('Server error');
    }
};

exports.getCheckout = async (req, res) => {
    try {
        res.render('checkout', {
            title: 'Checkout - 48 Roots',
            description: 'Complete your purchase',
            additionalCSS: ['checkout.css'],
            additionalJS: ['pages/checkout.js'],
            stripePublicKey: process.env.STRIPE_PUBLIC_KEY,
            layout: 'layout',
        });
    } catch (error) {
        logger.error('Error rendering checkout page:', error);
        res.status(500).send('Server error');
    }
};

exports.getOrderConfirmation = async (req, res) => {
    try {
        const { orderNumber } = req.params;
        res.render('order-confirmation', {
            title: 'Order Confirmation - 48 Roots',
            description: 'Thank you for your order',
            additionalCSS: ['order-confirmation.css'],
            additionalJS: ['pages/order-confirmation.js'],
            layout: 'layout',
            orderNumber,
        });
    } catch (error) {
        logger.error('Error rendering order confirmation page:', error);
        res.status(500).send('Server error');
    }
};

exports.getShipping = async (req, res) => {
    try {
        res.render('shipping', {
            title: 'Shipping Information - 48 Roots',
            description: 'Learn about our shipping policies and delivery times',
            additionalCSS: ['legal.css'],
            layout: 'layout',
        });
    } catch (error) {
        logger.error('Error rendering shipping page:', error);
        res.status(500).send('Server error');
    }
};

exports.getReturns = async (req, res) => {
    try {
        res.render('returns', {
            title: 'Returns & Exchanges - 48 Roots',
            description: 'Our return and exchange policy',
            additionalCSS: ['legal.css'],
            layout: 'layout',
        });
    } catch (error) {
        logger.error('Error rendering returns page:', error);
        res.status(500).send('Server error');
    }
};

exports.getFAQ = async (req, res) => {
    try {
        res.render('faq', {
            title: 'FAQ - 48 Roots',
            description: 'Frequently asked questions about 48 Roots',
            additionalCSS: ['faq.css'],
            additionalJS: ['pages/faq.js'],
            layout: 'layout',
        });
    } catch (error) {
        logger.error('Error rendering FAQ page:', error);
        res.status(500).send('Server error');
    }
};

exports.getSizeGuide = async (req, res) => {
    try {
        res.render('size-guide', {
            title: 'Size Guide - 48 Roots',
            description: 'Find your perfect fit with our size guide',
            additionalCSS: ['size-guide.css'],
            layout: 'layout',
        });
    } catch (error) {
        logger.error('Error rendering size guide page:', error);
        res.status(500).send('Server error');
    }
};

exports.getPrivacyPolicy = async (req, res) => {
    try {
        res.render('privacy-policy', {
            title: 'Privacy Policy - 48 Roots',
            description: 'Our privacy policy and data protection practices',
            additionalCSS: ['legal.css'],
            layout: 'layout',
        });
    } catch (error) {
        logger.error('Error rendering privacy policy page:', error);
        res.status(500).send('Server error');
    }
};

exports.getTermsOfService = async (req, res) => {
    try {
        res.render('terms-of-service', {
            title: 'Terms of Service - 48 Roots',
            description: 'Terms and conditions for using 48 Roots',
            additionalCSS: ['legal.css'],
            layout: 'layout',
        });
    } catch (error) {
        logger.error('Error rendering terms of service page:', error);
        res.status(500).send('Server error');
    }
};
