const express = require('express');
const { logger } = require('./utils/logger');
require('dotenv').config();

const {
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
} = require('./controllers/pageController');

const {
    getProducts,
    getFeaturedProducts,
    getProductBySlug,
    getRelatedProducts,
} = require('./controllers/shopController');

const {
    addToCart,
    updateCartItem,
    removeFromCart,
    getCartData,
} = require('./controllers/cartController');

// const { createCheckoutSession, confirmOrder } = require('./controllers/checkoutController');

// const { submitContactForm } = require('./controllers/contactController');

const { searchProducts } = require('./controllers/searchController');

const isProd = process.env.NODE_ENV === 'production';
process.env.STRIPE_PUBLIC_KEY = isProd
    ? process.env.STRIPE_PUBLIC_KEY_PROD
    : process.env.STRIPE_PUBLIC_KEY_TEST;

const router = express.Router();

router.get('/', getHome);
router.get('/shop', getShop);
router.get('/product/:slug', getProductDetail);
router.get('/new-arrivals', getNewArrivals);
router.get('/about', getAbout);
router.get('/impact', getImpact);
router.get('/contact', getContact);
router.get('/cart', getCart);
router.get('/checkout', getCheckout);
router.get('/order-confirmation/:orderNumber', getOrderConfirmation);
router.get('/shipping', getShipping);
router.get('/returns', getReturns);
router.get('/faq', getFAQ);
router.get('/size-guide', getSizeGuide);
router.get('/privacy-policy', getPrivacyPolicy);
router.get('/terms-of-service', getTermsOfService);

router.get('/api/products', getProducts);
router.get('/api/products/featured', getFeaturedProducts);
router.get('/api/products/:slug', getProductBySlug);
router.get('/api/products/related/:productId', getRelatedProducts);

router.post('/api/cart/add', addToCart);
router.post('/api/cart/update', updateCartItem);
router.post('/api/cart/remove', removeFromCart);
router.get('/api/cart', getCartData);

// router.post('/api/checkout/create-session', createCheckoutSession);
// router.post('/api/checkout/confirm', confirmOrder);

// router.post('/api/contact', submitContactForm);

router.get('/api/search', searchProducts);

module.exports = router;
