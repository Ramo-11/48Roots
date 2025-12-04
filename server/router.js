const express = require('express');
const crypto = require('crypto');
require('dotenv').config();

const router = express.Router();

// Controllers
const productController = require('./controllers/productController');
const cartController = require('./controllers/cartController');
const checkoutController = require('./controllers/checkoutController');
const orderController = require('./controllers/orderController');

// Admin Controllers
const adminPrintfulController = require('./controllers/admin/printfulController');

// Middleware
const { isAdmin, attachUserToLocals } = require('./middleware/auth');

// Attach user to all requests
router.use(attachUserToLocals);

/**
 * PUBLIC ROUTES
 */

// Pages
router.get('/', (req, res) => {
    res.render('index', {
        title: '48 Roots - Apparel with Purpose',
        description: 'Shop clothing that makes a difference',
        additionalCSS: ['home.css'],
        additionalJS: ['home.js'],
    });
});

router.get('/shop', productController.getShopPage);
router.get('/product/:slug', productController.getProductPage);
router.get('/cart', cartController.getCartPage);
router.get('/checkout', checkoutController.getCheckoutPage);
router.get('/order-confirmation/:orderNumber', orderController.getOrderConfirmationPage);

router.get('/about', (req, res) => {
    res.render('about', {
        title: 'Our Story - 48 Roots',
        description: 'Learn about our mission',
        additionalCSS: ['about.css'],
    });
});

router.get('/impact', (req, res) => {
    res.render('impact', {
        title: 'Our Impact - 48 Roots',
        description: 'See the difference we make together',
        additionalCSS: ['impact.css'],
    });
});

router.get('/new-arrivals', productController.getNewArrivalsPage);

// API - Products
router.get('/api/products', productController.getProducts);
router.get('/api/products/:slug', productController.getProductBySlug);
router.get('/api/search', productController.searchProducts);

// API - Cart
router.get('/api/cart', cartController.getCart);
router.post('/api/cart/add', cartController.addToCart);
router.put('/api/cart/update', cartController.updateCartItem);
router.delete('/api/cart/remove/:itemId', cartController.removeFromCart);
router.delete('/api/cart/clear', cartController.clearCart);

// API - Checkout
router.post('/api/checkout/calculate-shipping', checkoutController.calculateShipping);
router.post('/api/checkout/create-session', checkoutController.createCheckoutSession);
router.post('/api/checkout/confirm', checkoutController.confirmOrder);

// API - Orders
router.get('/api/orders/:orderNumber', orderController.getOrderByNumber);
router.post('/api/orders/:orderNumber/refresh', orderController.refreshOrderStatus);

/**
 * ADMIN ROUTES
 */
const { adminLogin, adminLogout } = require('./middleware/auth');

// Admin login page (public)
router.get('/admin/login', (req, res) => {
    if (req.session?.user?.isAdmin) {
        return res.redirect('/admin');
    }
    res.render('admin/login', {
        title: 'Admin Login - 48 Roots',
    });
});

// Admin login API (public)
router.post('/api/admin/login', adminLogin);

// Admin logout
router.get('/admin/logout', adminLogout);

const adminWeb = express.Router();
const adminAPI = express.Router();

// Protect admin routes
adminWeb.use(isAdmin);
adminAPI.use(isAdmin);

// Admin Pages
adminWeb.get(['/', '/dashboard'], adminPrintfulController.getDashboard);

// Admin API - Printful Sync
adminAPI.get('/printful/status', adminPrintfulController.getSyncStatus);
adminAPI.post('/printful/sync', adminPrintfulController.syncAllProducts);

// Admin API - Products
adminAPI.get('/products', adminPrintfulController.getProducts);
adminAPI.put('/products/:productId', adminPrintfulController.updateProduct);
adminAPI.put('/products/:productId/toggle-active', adminPrintfulController.toggleProductStatus);
adminAPI.put('/products/:productId/toggle-featured', adminPrintfulController.toggleProductFeatured);
adminAPI.delete('/products/:productId', adminPrintfulController.deleteProduct);

// Admin API - Orders
adminAPI.get('/orders', adminPrintfulController.getRecentOrders);
adminAPI.post('/orders/:orderId/refresh', adminPrintfulController.refreshOrderStatus);

// Mount admin routers
router.use('/admin', adminWeb);
router.use('/api/admin', adminAPI);

/**
 * WEBHOOKS (No auth required)
 */
router.post(
    '/api/webhooks/printful',
    express.raw({ type: 'application/json' }),
    async (req, res) => {
        const { logger } = require('./utils/logger');
        const Order = require('../models/Order');
        const { getPrintfulOrderStatus } = require('./config/printful');

        try {
            // Verify webhook signature if secret is configured
            if (process.env.PRINTFUL_WEBHOOK_SECRET) {
                const signature = req.headers['x-printful-signature'];
                const expectedSignature = crypto
                    .createHmac('sha256', process.env.PRINTFUL_WEBHOOK_SECRET)
                    .update(req.body)
                    .digest('hex');

                if (signature !== expectedSignature) {
                    logger.warn('Invalid Printful webhook signature');
                    return res.status(401).json({ error: 'Invalid signature' });
                }
            }

            const payload = JSON.parse(req.body.toString());
            const { type, data } = payload;

            logger.info(`Received Printful webhook: ${type}`);

            if (!data?.order?.id) {
                return res.status(200).json({ received: true });
            }

            const order = await Order.findOne({
                'fulfillment.printfulOrderId': data.order.id,
            });

            if (!order) {
                logger.warn(`Order not found for Printful order ${data.order.id}`);
                return res.status(200).json({ received: true });
            }

            switch (type) {
                case 'package_shipped':
                case 'order_updated':
                case 'order_failed':
                case 'order_canceled': {
                    const printfulOrder = await getPrintfulOrderStatus(data.order.id);
                    if (printfulOrder) {
                        await order.updateFromPrintful(printfulOrder);
                        logger.info(`Updated order ${order.orderNumber} from webhook: ${type}`);
                    }
                    break;
                }
                default:
                    logger.info(`Unhandled webhook type: ${type}`);
            }

            res.status(200).json({ received: true });
        } catch (error) {
            logger.error('Webhook processing error:', error);
            res.status(200).json({ received: true });
        }
    }
);

// Stripe webhook
router.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
    const { logger } = require('./utils/logger');
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

    const sig = req.headers['stripe-signature'];

    try {
        const event = stripe.webhooks.constructEvent(
            req.body,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
        );

        switch (event.type) {
            case 'payment_intent.succeeded':
                logger.info(`Payment succeeded: ${event.data.object.id}`);
                break;
            case 'payment_intent.payment_failed':
                logger.warn(`Payment failed: ${event.data.object.id}`);
                break;
            default:
                logger.info(`Unhandled Stripe event: ${event.type}`);
        }

        res.status(200).json({ received: true });
    } catch (error) {
        logger.error('Stripe webhook error:', error.message);
        res.status(400).json({ error: error.message });
    }
});

/**
 * ERROR HANDLING
 */
router.use((req, res) => {
    res.status(404).render('errors/404', {
        title: 'Page Not Found - 48 Roots',
        additionalCSS: ['errors.css'],
    });
});

module.exports = router;
