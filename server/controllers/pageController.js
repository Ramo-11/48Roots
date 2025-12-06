const { logger } = require('../utils/logger');
const Product = require('../../models/Product');
const { isAdmin } = require('./authController');

// ==========================================
// Public Page Handlers
// ==========================================

const getHome = async (req, res) => {
    try {
        const featuredProducts = await Product.find({ isActive: true, isFeatured: true })
            .limit(4)
            .lean();

        res.render('index', {
            title: '48 Roots - Palestinian-Inspired Apparel',
            description:
                'Shop Palestinian-inspired apparel that gives back. A portion of every purchase supports Palestinian relief organizations.',
            currentPage: 'home',
            isAdmin: false,
            layout: 'layout',
            featuredProducts,
            additionalCSS: ['index.css'],
            additionalJS: ['pages/index.js'],
        });
    } catch (error) {
        logger.error('Error rendering home page:', error);
        res.status(500).render('error', {
            title: 'Error',
            description: 'Failed to load home page',
        });
    }
};

const getShop = async (req, res) => {
    try {
        res.render('shop', {
            title: 'Shop - 48 Roots',
            description: 'Browse our curated collection of Palestinian-inspired apparel.',
            isAdmin: false,
            currentPage: 'shop',
            additionalCSS: ['shop.css'],
            additionalJS: ['pages/shop.js'],
        });
    } catch (error) {
        logger.error('Error rendering shop page:', error);
        res.status(500).render('error', {
            title: 'Error',
            description: 'Failed to load shop page',
        });
    }
};

const getProductDetail = async (req, res) => {
    try {
        const { slug } = req.params;
        const product = await Product.findOne({ slug, isActive: true }).lean();

        if (!product) {
            return res.status(404).render('404', {
                title: 'Product Not Found - 48 Roots',
                description: 'The product you are looking for does not exist.',
            });
        }

        res.render('product', {
            title: `${product.name} - 48 Roots`,
            description: product.description || `Shop ${product.name} from 48 Roots.`,
            isAdmin: false,
            currentPage: 'shop',
            product,
            additionalCSS: ['product.css'],
            additionalJS: ['pages/product.js'],
        });
    } catch (error) {
        logger.error('Error rendering product page:', error);
        res.status(500).render('error', {
            title: 'Error',
            description: 'Failed to load product page',
        });
    }
};

const getNewArrivals = async (req, res) => {
    try {
        res.render('new-arrivals', {
            title: 'New Arrivals - 48 Roots',
            description: 'Explore our newest additions to the 48 Roots collection.',
            isAdmin: false,
            currentPage: 'new-arrivals',
            additionalCSS: ['shop.css'],
            additionalJS: ['pages/new-arrivals.js'],
        });
    } catch (error) {
        logger.error('Error rendering new arrivals page:', error);
        res.status(500).render('error', {
            title: 'Error',
            description: 'Failed to load new arrivals page',
        });
    }
};

const getAbout = (req, res) => {
    res.render('about', {
        title: 'About Us - 48 Roots',
        description:
            'Learn about 48 Roots and our mission to support Palestinian communities through apparel.',
        isAdmin: false,
        currentPage: 'about',
        additionalCSS: ['about.css'],
        additionalJS: ['pages/about.js'],
    });
};

const getImpact = (req, res) => {
    res.render('impact', {
        title: 'Our Impact - 48 Roots',
        description: 'See how your purchases help fund Palestinian relief organizations.',
        isAdmin: false,
        currentPage: 'impact',
        additionalCSS: ['impact.css'],
        additionalJS: ['pages/impact.js'],
    });
};

const getContact = (req, res) => {
    res.render('contact', {
        title: 'Contact Us - 48 Roots',
        description: 'Have questions? Reach out to the 48 Roots team.',
        isAdmin: false,
        currentPage: 'contact',
        additionalCSS: ['contact.css'],
        additionalJS: ['pages/contact.js'],
    });
};

const getCart = (req, res) => {
    res.render('cart', {
        title: 'Your Cart - 48 Roots',
        description: 'Review and edit the items in your shopping cart.',
        isAdmin: false,
        currentPage: 'cart',
        additionalCSS: ['cart.css'],
        additionalJS: ['pages/cart.js'],
    });
};

const getCheckout = (req, res) => {
    res.render('checkout', {
        title: 'Checkout - 48 Roots',
        description: 'Enter your shipping and payment details to complete your order.',
        isAdmin: false,
        currentPage: 'checkout',
        stripePublicKey: process.env.STRIPE_PUBLIC_KEY,
        additionalCSS: ['checkout.css'],
        additionalJS: ['pages/checkout.js'],
    });
};

const getOrderConfirmation = async (req, res) => {
    try {
        const { orderNumber } = req.params;

        res.render('order-confirmation', {
            title: 'Order Confirmed - 48 Roots',
            description: 'Your order has been successfully placed.',
            isAdmin: false,
            currentPage: 'order-confirmation',
            orderNumber,
            additionalCSS: ['order-confirmation.css'],
            additionalJS: ['pages/order-confirmation.js'],
        });
    } catch (error) {
        logger.error('Error rendering order confirmation:', error);
        res.status(500).render('error', {
            title: 'Error',
            description: 'Failed to load order confirmation page.',
        });
    }
};

const getShipping = (req, res) => {
    res.render('shipping', {
        title: 'Shipping Info - 48 Roots',
        description: 'Learn about our shipping options, delivery times, and policies.',
        isAdmin: false,
        currentPage: 'shipping',
        additionalCSS: ['info-pages.css'],
    });
};

const getReturns = (req, res) => {
    res.render('returns', {
        title: 'Returns & Exchanges - 48 Roots',
        description: 'Learn how to return or exchange your 48 Roots products.',
        isAdmin: false,
        currentPage: 'returns',
        additionalCSS: ['info-pages.css'],
    });
};

const getFAQ = (req, res) => {
    res.render('faq', {
        title: 'FAQ - 48 Roots',
        description: 'Frequently asked questions about shipping, orders, sizing, and more.',
        isAdmin: false,
        currentPage: 'faq',
        additionalCSS: ['info-pages.css'],
        additionalJS: ['pages/faq.js'],
    });
};

const getSizeGuide = (req, res) => {
    res.render('size-guide', {
        title: 'Size Guide - 48 Roots',
        description: 'Find your perfect fit with our detailed size guide.',
        isAdmin: false,
        currentPage: 'size-guide',
        additionalCSS: ['info-pages.css'],
    });
};

const getPrivacyPolicy = (req, res) => {
    res.render('privacy-policy', {
        title: 'Privacy Policy - 48 Roots',
        description: 'Understand how 48 Roots collects and protects your data.',
        isAdmin: false,
        currentPage: 'privacy-policy',
        additionalCSS: ['info-pages.css'],
    });
};

const getTermsOfService = (req, res) => {
    res.render('terms-of-service', {
        title: 'Terms of Service - 48 Roots',
        description: 'Review the terms and conditions for using our store.',
        isAdmin: false,
        currentPage: 'terms-of-service',
        additionalCSS: ['info-pages.css'],
    });
};

// ==========================================
// Admin Page Handlers
// ==========================================

const getAdminLogin = (req, res) => {
    if (req.session?.adminId) {
        return res.redirect('/admin/login');
    }

    res.render('admin/login', {
        title: 'Admin Login - 48 Roots',
        description: 'Sign in to the 48 Roots admin dashboard.',
        isAdmin: false,
        additionalCSS: ['admin/login.css'],
        additionalJS: ['pages/admin/login.js'],
        isAdmin: true,
    });
};

const getAdminDashboard = (req, res) => {
    res.render('admin/dashboard', {
        title: 'Admin Dashboard - 48 Roots',
        description: 'Manage products, orders, and store settings.',
        isAdmin: true,
        additionalCSS: ['admin/dashboard.css'],
        additionalJS: ['pages/admin/dashboard.js'],
    });
};

module.exports = {
    getHome,
    getShop,
    getProductDetail,
    getNewArrivals,
    getAbout,
    getImpact,
    getContact,
    getCart,
    getCheckout,
    getOrderConfirmation,
    getShipping,
    getReturns,
    getFAQ,
    getSizeGuide,
    getPrivacyPolicy,
    getTermsOfService,
    getAdminLogin,
    getAdminDashboard,
};
