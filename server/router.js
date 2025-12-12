const express = require('express');
require('dotenv').config();

const router = express.Router();

const { logger } = require('./utils/logger');

// Controllers — Public
const pageController = require('./controllers/pageController');
const shopController = require('./controllers/shopController');
const cartController = require('./controllers/cartController');
const checkoutController = require('./controllers/checkoutController');
const searchController = require('./controllers/searchController');

// Admin Controllers
const authController = require('./controllers/authController');
const printfulAdminController = require('./controllers/admin/printfulController');
const promotionAdminController = require('./controllers/admin/promotionController');
const analyticsAdminController = require('./controllers/admin/analyticsController');
const cloudinaryController = require('./controllers/cloudinaryController');

// Public Controllers
const promotionController = require('./controllers/promotionController');
const analyticsController = require('./controllers/analyticsController');

// Models
const Settings = require('../models/Settings');
const Announcement = require('../models/Announcement');
const Order = require('../models/Order');

const { getPrintfulOrderStatus } = require('./config/printful');

/* ============================================================================
    PUBLIC ROUTES
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
    AUTH (ADMIN)
============================================================================ */
router.get('/admin/login', authController.getLogin);
router.post('/auth/login', authController.login);
router.get('/admin/logout', authController.logout);

/* ============================================================================
    ADMIN DASHBOARD (Protected)
============================================================================ */
router.get('/admin/dashboard', authController.isAuthenticated, pageController.getAdminDashboard);
router.get('/admin/products', authController.isAuthenticated, pageController.getAdminProducts);
router.get('/admin/orders', authController.isAuthenticated, pageController.getAdminOrders);
router.get('/admin/promotions', authController.isAuthenticated, pageController.getAdminPromotions);
router.get('/admin/analytics', authController.isAuthenticated, pageController.getAdminAnalytics);

/* ============================================================================
    ADMIN API — Protected
============================================================================ */
router.get(
    '/api/admin/printful/status',
    authController.isAuthenticated,
    printfulAdminController.getSyncStatus
);

router.post(
    '/api/admin/printful/sync',
    authController.isAuthenticated,
    printfulAdminController.syncAllProducts
);

router.post(
    '/api/admin/printful/sync/:printfulProductId',
    authController.isAuthenticated,
    printfulAdminController.syncSingleProduct
);

router.get(
    '/api/admin/products',
    authController.isAuthenticated,
    printfulAdminController.getProducts
);

router.put(
    '/api/admin/products/:productId',
    authController.isAuthenticated,
    printfulAdminController.updateProduct
);

router.put(
    '/api/admin/products/:productId/toggle-active',
    authController.isAuthenticated,
    printfulAdminController.toggleProductStatus
);

router.put(
    '/api/admin/products/:productId/toggle-featured',
    authController.isAuthenticated,
    printfulAdminController.toggleProductFeatured
);

router.delete(
    '/api/admin/products/:productId',
    authController.isAuthenticated,
    printfulAdminController.deleteProduct
);

// Product Image Upload
router.post(
    '/api/admin/products/:productId/image',
    authController.isAuthenticated,
    cloudinaryController.upload.single('image'),
    cloudinaryController.handleImageUpload
);

router.put(
    '/api/admin/products/:productId/images',
    authController.isAuthenticated,
    printfulAdminController.updateProductImages
);

router.get(
    '/api/admin/products/:productId/edit',
    authController.isAuthenticated,
    printfulAdminController.getProductForEdit
);

router.get(
    '/api/admin/orders',
    authController.isAuthenticated,
    printfulAdminController.getRecentOrders
);

router.post(
    '/api/admin/orders/:orderId/refresh',
    authController.isAuthenticated,
    printfulAdminController.refreshOrderStatus
);

/* ============================================================================
    ADMIN API — Promotions
============================================================================ */
router.get(
    '/api/admin/promotions',
    authController.isAuthenticated,
    promotionAdminController.getPromotions
);

router.get(
    '/api/admin/promotions/products',
    authController.isAuthenticated,
    promotionAdminController.getProductsForSelection
);

router.get(
    '/api/admin/promotions/:promotionId',
    authController.isAuthenticated,
    promotionAdminController.getPromotion
);

router.post(
    '/api/admin/promotions',
    authController.isAuthenticated,
    promotionAdminController.createPromotion
);

router.put(
    '/api/admin/promotions/:promotionId',
    authController.isAuthenticated,
    promotionAdminController.updatePromotion
);

router.put(
    '/api/admin/promotions/:promotionId/toggle-active',
    authController.isAuthenticated,
    promotionAdminController.togglePromotionStatus
);

router.delete(
    '/api/admin/promotions/:promotionId',
    authController.isAuthenticated,
    promotionAdminController.deletePromotion
);

/* ============================================================================
    ADMIN API — Analytics
============================================================================ */
router.get(
    '/api/admin/analytics/overview',
    authController.isAuthenticated,
    analyticsAdminController.getDashboardOverview
);

router.get(
    '/api/admin/analytics/time-series',
    authController.isAuthenticated,
    analyticsAdminController.getTimeSeriesData
);

router.get(
    '/api/admin/analytics/top-products',
    authController.isAuthenticated,
    analyticsAdminController.getTopProducts
);

router.get(
    '/api/admin/analytics/traffic-sources',
    authController.isAuthenticated,
    analyticsAdminController.getTrafficSources
);

router.get(
    '/api/admin/analytics/devices',
    authController.isAuthenticated,
    analyticsAdminController.getDeviceBreakdown
);

router.get(
    '/api/admin/analytics/searches',
    authController.isAuthenticated,
    analyticsAdminController.getRecentSearches
);

router.get(
    '/api/admin/analytics/promotions',
    authController.isAuthenticated,
    analyticsAdminController.getPromotionAnalytics
);

/* ============================================================================
    PUBLIC APIs
============================================================================ */
// Products
router.get('/api/products', shopController.getProducts);
router.get('/api/products/featured', shopController.getFeaturedProducts);
router.get('/api/products/related/:productId', shopController.getRelatedProducts);
router.get('/api/products/:slug', shopController.getProductBySlug);

// Cart
router.post('/api/cart/add', cartController.addToCart);
router.post('/api/cart/update', cartController.updateCartItem);
router.post('/api/cart/remove', cartController.removeFromCart);
router.get('/api/cart', cartController.getCartData);

// Checkout
router.post('/api/checkout/create-session', checkoutController.createCheckoutSession);
router.post('/api/checkout/confirm', checkoutController.confirmOrder);
router.post('/api/checkout/calculate-shipping', checkoutController.calculateShipping);
router.get('/api/orders/:orderNumber', checkoutController.getOrderByNumber);

// Search
router.get('/api/search', searchController.searchProducts);

// Promotions (Public)
router.get('/api/promotions/banners', promotionController.getActiveBanners);
router.get('/api/promotions/auto-apply', promotionController.getAutoApplyPromotions);
router.post('/api/promotions/validate', promotionController.validateCode);
router.get('/api/promotions/product/:productId', promotionController.getProductPromotions);
router.post('/api/promotions/calculate-cart', promotionController.calculateCartDiscount);

// Analytics (Public tracking endpoints)
router.post('/api/analytics/track', analyticsController.trackEvent);
router.post('/api/analytics/pageview', analyticsController.trackPageView);
router.post('/api/analytics/product-view', analyticsController.trackProductView);

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
    });
});

module.exports = router;
