const express = require('express');
const { logger } = require('./utils/logger');
require('dotenv').config();

const pageController = require('./controllers/pageController');
const shopController = require('./controllers/shopController');
const cartController = require('./controllers/cartController');
const checkoutController = require('./controllers/checkoutController');
const searchController = require('./controllers/searchController');
const printfulAdminController = require('./controllers/admin/printfulController');

// Auth middleware
const auth = require('./middleware/auth');

// Settings & Announcements
const Settings = require('../models/Settings');
const Announcement = require('../models/Announcement');

// Printful webhook helpers
const { getPrintfulOrderStatus } = require('./config/printful');
const Order = require('../models/Order');

const router = express.Router();

// Stripe public key setup
const isProd = process.env.NODE_ENV === 'production';
process.env.STRIPE_PUBLIC_KEY = isProd
    ? process.env.STRIPE_PUBLIC_KEY_PROD
    : process.env.STRIPE_PUBLIC_KEY_TEST;

// ==========================================
// Public Page Routes
// ==========================================
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

// ==========================================
// Admin Page Routes
// ==========================================
router.get('/admin/login', pageController.getAdminLogin);
router.get('/admin', auth.isAdmin, pageController.getAdminDashboard);
router.get('/admin/logout', auth.adminLogout);

// ==========================================
// Admin Auth API
// ==========================================
router.post('/api/admin/login', auth.adminLogin);

// ==========================================
// Admin Protected API Routes
// ==========================================
router.get('/api/admin/printful/status', auth.isAdmin, printfulAdminController.getSyncStatus);
router.post('/api/admin/printful/sync', auth.isAdmin, printfulAdminController.syncAllProducts);
router.post(
    '/api/admin/printful/sync/:printfulProductId',
    auth.isAdmin,
    printfulAdminController.syncSingleProduct
);

router.get('/api/admin/products', auth.isAdmin, printfulAdminController.getProducts);
router.put('/api/admin/products/:productId', auth.isAdmin, printfulAdminController.updateProduct);
router.put(
    '/api/admin/products/:productId/toggle-active',
    auth.isAdmin,
    printfulAdminController.toggleProductStatus
);
router.put(
    '/api/admin/products/:productId/toggle-featured',
    auth.isAdmin,
    printfulAdminController.toggleProductFeatured
);
router.delete(
    '/api/admin/products/:productId',
    auth.isAdmin,
    printfulAdminController.deleteProduct
);

router.get('/api/admin/orders', auth.isAdmin, printfulAdminController.getRecentOrders);
router.post(
    '/api/admin/orders/:orderId/refresh',
    auth.isAdmin,
    printfulAdminController.refreshOrderStatus
);

// ==========================================
// Product API
// ==========================================
router.get('/api/products', shopController.getProducts);
router.get('/api/products/featured', shopController.getFeaturedProducts);
router.get('/api/products/related/:productId', shopController.getRelatedProducts);
router.get('/api/products/:slug', shopController.getProductBySlug);

// ==========================================
// Cart API
// ==========================================
router.post('/api/cart/add', cartController.addToCart);
router.post('/api/cart/update', cartController.updateCartItem);
router.post('/api/cart/remove', cartController.removeFromCart);
router.get('/api/cart', cartController.getCartData);

// ==========================================
// Checkout API
// ==========================================
router.post('/api/checkout/create-session', checkoutController.createCheckoutSession);
router.post('/api/checkout/confirm', checkoutController.confirmOrder);
router.post('/api/checkout/calculate-shipping', checkoutController.calculateShipping);
router.get('/api/orders/:orderNumber', checkoutController.getOrderByNumber);

// ==========================================
// Search API
// ==========================================
router.get('/api/search', searchController.searchProducts);

// ==========================================
// Settings API
// ==========================================
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

// ==========================================
// Announcements API
// ==========================================
router.get('/api/announcements/active', async (req, res) => {
    try {
        const now = new Date();
        const announcements = await Announcement.find({ isActive: true })
            .sort({ priority: -1 })
            .lean();
        const filtered = announcements.filter((a) => {
            if (a.startDate && now < new Date(a.startDate)) return false;
            if (a.endDate && now > new Date(a.endDate)) return false;
            return true;
        });
        res.json({ success: true, data: filtered });
    } catch (error) {
        logger.error('Error getting announcements:', error);
        res.status(500).json({ success: false, message: 'Failed to get announcements' });
    }
});

// ==========================================
// Printful Webhooks
// ==========================================
router.post('/api/webhooks/printful', async (req, res) => {
    try {
        const { type, data } = req.body;
        logger.info(`Received Printful webhook: ${type}`);

        switch (type) {
            case 'package_shipped':
            case 'order_updated':
            case 'order_failed':
            case 'order_canceled':
                if (data.order?.id) {
                    const order = await Order.findOne({
                        'fulfillment.printfulOrderId': data.order.id,
                    });
                    if (order) {
                        const printfulOrder = await getPrintfulOrderStatus(data.order.id);
                        if (printfulOrder) await order.updateFromPrintful(printfulOrder);
                    }
                }
                break;
        }

        res.status(200).json({ received: true });
    } catch (error) {
        logger.error('Error processing webhook:', error);
        res.status(200).json({ received: true, error: error.message });
    }
});

// ==========================================
// Health Check
// ==========================================
router.get('/api/health', (req, res) => {
    res.json({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
    });
});

module.exports = router;
