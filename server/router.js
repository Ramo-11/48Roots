const express = require('express');
require('dotenv').config();

const { logger } = require('./utils/logger');

// Controllers
const pageController = require('./controllers/pageController');
const shopController = require('./controllers/shopController');
const cartController = require('./controllers/cartController');
const checkoutController = require('./controllers/checkoutController');
const searchController = require('./controllers/searchController');
const printfulAdminController = require('./controllers/admin/printfulController');

// Auth Controller (NEW SYSTEM)
const authController = require('./controllers/authController');

// Models
const Settings = require('../models/Settings');
const Announcement = require('../models/Announcement');
const Order = require('../models/Order');

// Printful utilities
const { getPrintfulOrderStatus } = require('./config/printful');

// Router instance
const router = express.Router();

// Stripe public key
const isProd = process.env.NODE_ENV === 'production';
process.env.STRIPE_PUBLIC_KEY = isProd
    ? process.env.STRIPE_PUBLIC_KEY_PROD
    : process.env.STRIPE_PUBLIC_KEY_TEST;

/* ============================================================================
    PUBLIC PAGES
============================================================================ */
router.get('/', pageController.getHome);
router.get('/shop', pageController.getShop);
router.get('/product/:slug', pageController.getProductDetail);
router.get('/new-arrivals', pageController.getNewArrivals);
router.get('/about', pageController.getAbout);
router.get('/impact', pageController.getImpact);
router.get('/contact', pageController.getContact);
router.get('/cart', pageController.getCart);
router.get('/checkout', pageController.getCheckout);
router.get('/order-confirmation/:orderNumber', pageController.getOrderConfirmation);
router.get('/shipping', pageController.getShipping);
router.get('/returns', pageController.getReturns);
router.get('/faq', pageController.getFAQ);
router.get('/size-guide', pageController.getSizeGuide);
router.get('/privacy-policy', pageController.getPrivacyPolicy);
router.get('/terms-of-service', pageController.getTermsOfService);

/* ============================================================================
    AUTH (Admin Login)
============================================================================ */
router.get('/admin/login', authController.getLogin);
router.post('/auth/login', authController.login);
router.get('/logout', authController.logout);

/* ============================================================================
    ADMIN DASHBOARD PAGES
============================================================================ */
router.get(
    '/admin',
    authController.isAuthenticated,
    authController.isAdmin,
    pageController.getAdminDashboard
);

/* ============================================================================
    ADMIN API — PROTECTED
============================================================================ */
router.get(
    '/api/admin/printful/status',
    authController.isAuthenticated,
    authController.isAdmin,
    printfulAdminController.getSyncStatus
);

router.post(
    '/api/admin/printful/sync',
    authController.isAuthenticated,
    authController.isAdmin,
    printfulAdminController.syncAllProducts
);

router.post(
    '/api/admin/printful/sync/:printfulProductId',
    authController.isAuthenticated,
    authController.isAdmin,
    printfulAdminController.syncSingleProduct
);

router.get(
    '/api/admin/products',
    authController.isAuthenticated,
    authController.isAdmin,
    printfulAdminController.getProducts
);

router.put(
    '/api/admin/products/:productId',
    authController.isAuthenticated,
    authController.isAdmin,
    printfulAdminController.updateProduct
);

router.put(
    '/api/admin/products/:productId/toggle-active',
    authController.isAuthenticated,
    authController.isAdmin,
    printfulAdminController.toggleProductStatus
);

router.put(
    '/api/admin/products/:productId/toggle-featured',
    authController.isAuthenticated,
    authController.isAdmin,
    printfulAdminController.toggleProductFeatured
);

router.delete(
    '/api/admin/products/:productId',
    authController.isAuthenticated,
    authController.isAdmin,
    printfulAdminController.deleteProduct
);

router.get(
    '/api/admin/orders',
    authController.isAuthenticated,
    authController.isAdmin,
    printfulAdminController.getRecentOrders
);

router.post(
    '/api/admin/orders/:orderId/refresh',
    authController.isAuthenticated,
    authController.isAdmin,
    printfulAdminController.refreshOrderStatus
);

/* ============================================================================
    PRODUCT API
============================================================================ */
router.get('/api/products', shopController.getProducts);
router.get('/api/products/featured', shopController.getFeaturedProducts);
router.get('/api/products/related/:productId', shopController.getRelatedProducts);
router.get('/api/products/:slug', shopController.getProductBySlug);

/* ============================================================================
    CART API
============================================================================ */
router.post('/api/cart/add', cartController.addToCart);
router.post('/api/cart/update', cartController.updateCartItem);
router.post('/api/cart/remove', cartController.removeFromCart);
router.get('/api/cart', cartController.getCartData);

/* ============================================================================
    CHECKOUT API
============================================================================ */
router.post('/api/checkout/create-session', checkoutController.createCheckoutSession);
router.post('/api/checkout/confirm', checkoutController.confirmOrder);
router.post('/api/checkout/calculate-shipping', checkoutController.calculateShipping);
router.get('/api/orders/:orderNumber', checkoutController.getOrderByNumber);

/* ============================================================================
    SEARCH API
============================================================================ */
router.get('/api/search', searchController.searchProducts);

/* ============================================================================
    SETTINGS API
============================================================================ */
router.get('/api/settings/:key', async (req, res) => {
    try {
        const value = await Settings.get(req.params.key);
        if (value === null) {
            return res.status(404).json({ success: false, message: 'Setting not found' });
        }
        res.json({ success: true, data: value });
    } catch (error) {
        logger.error('Error getting setting:', error);
        res.status(500).json({ success: false, message: 'Failed to get setting' });
    }
});

/* ============================================================================
    ANNOUNCEMENTS API
============================================================================ */
router.get('/api/announcements/active', async (req, res) => {
    try {
        const now = new Date();
        const announcements = await Announcement.find({ isActive: true })
            .sort({ priority: -1 })
            .lean();

        const active = announcements.filter((a) => {
            if (a.startDate && now < new Date(a.startDate)) return false;
            if (a.endDate && now > new Date(a.endDate)) return false;
            return true;
        });

        res.json({ success: true, data: active });
    } catch (error) {
        logger.error('Error getting announcements:', error);
        res.status(500).json({ success: false, message: 'Failed to get announcements' });
    }
});

/* ============================================================================
    PRINTFUL WEBHOOK
============================================================================ */
router.post('/api/webhooks/printful', async (req, res) => {
    try {
        const { type, data } = req.body;
        logger.info(`Received Printful webhook: ${type}`);

        if (data?.order?.id) {
            const order = await Order.findOne({
                'fulfillment.printfulOrderId': data.order.id,
            });

            if (order) {
                const updatedOrder = await getPrintfulOrderStatus(data.order.id);
                if (updatedOrder) await order.updateFromPrintful(updatedOrder);
            }
        }

        res.status(200).json({ received: true });
    } catch (error) {
        logger.error('Webhook error:', error);
        res.status(200).json({ received: true, error: error.message });
    }
});

/* ============================================================================
    HEALTH CHECK
============================================================================ */
router.get('/api/health', (req, res) => {
    res.json({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
    });
});

module.exports = router;
