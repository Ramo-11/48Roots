const axios = require('axios');
const { logger } = require('../utils/logger');
require('dotenv').config();

/**
 * Printful API Client
 * Base URL: https://api.printful.com
 * Authentication: Bearer token
 */
const printfulClient = axios.create({
    baseURL: 'https://api.printful.com',
    headers: {
        Authorization: `Bearer ${process.env.PRINTFUL_API_TOKEN}`,
        'Content-Type': 'application/json',
    },
    timeout: 30000,
});

// Response interceptor for logging and error handling
printfulClient.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response) {
            logger.error('Printful API Error:', {
                status: error.response.status,
                data: error.response.data,
                url: error.config?.url,
            });
        } else {
            logger.error('Printful API Network Error:', error.message);
        }
        return Promise.reject(error);
    }
);

/**
 * Get all sync products from Printful store
 * @returns {Promise<Array>} Array of sync products
 */
const getSyncProducts = async () => {
    try {
        const products = [];
        let offset = 0;
        const limit = 100;
        let hasMore = true;

        while (hasMore) {
            const response = await printfulClient.get('/store/products', {
                params: { offset, limit },
            });

            if (response.data.code === 200) {
                products.push(...response.data.result);
                const paging = response.data.paging;
                hasMore = paging && offset + limit < paging.total;
                offset += limit;
            } else {
                hasMore = false;
            }
        }

        logger.info(`Retrieved ${products.length} sync products from Printful`);
        return products;
    } catch (error) {
        logger.error('Failed to get sync products from Printful:', error.message);
        return [];
    }
};

/**
 * Get detailed sync product info including variants
 * @param {number|string} syncProductId - Sync product ID or external ID (prefixed with @)
 * @returns {Promise<Object|null>} Sync product with variants or null
 */
const getSyncProductDetails = async (syncProductId) => {
    try {
        const response = await printfulClient.get(`/store/products/${syncProductId}`);

        if (response.data.code === 200) {
            return response.data.result;
        }
        return null;
    } catch (error) {
        logger.error(`Failed to get sync product ${syncProductId}:`, error.message);
        return null;
    }
};

/**
 * Get catalog product info (blank product details)
 * @param {number} productId - Printful catalog product ID
 * @returns {Promise<Object|null>} Product info or null
 */
const getCatalogProduct = async (productId) => {
    try {
        const response = await printfulClient.get(`/products/${productId}`);

        if (response.data.code === 200) {
            return response.data.result;
        }
        return null;
    } catch (error) {
        logger.error(`Failed to get catalog product ${productId}:`, error.message);
        return null;
    }
};

/**
 * Get variant info from catalog
 * @param {number} variantId - Printful variant ID
 * @returns {Promise<Object|null>} Variant info or null
 */
const getCatalogVariant = async (variantId) => {
    try {
        const response = await printfulClient.get(`/products/variant/${variantId}`);

        if (response.data.code === 200) {
            return response.data.result;
        }
        return null;
    } catch (error) {
        logger.error(`Failed to get catalog variant ${variantId}:`, error.message);
        return null;
    }
};

/**
 * Calculate shipping rates for an order
 * @param {Object} orderData - Order data with recipient and items
 * @returns {Promise<number>} Shipping cost or 0
 */
const calculatePrintfulShipping = async (items, address) => {
    try {
        // Build the shipping rate request
        const shippingRequest = {
            recipient: {
                address1: address.line1 || address.address1,
                city: address.city,
                country_code: address.country || 'US',
                state_code: address.state,
                zip: address.postalCode || address.zip,
            },
            items: items.map((item) => ({
                variant_id: item.variant?.printfulVariantId || item.printfulVariantId,
                quantity: item.quantity,
            })),
        };

        const response = await printfulClient.post('/shipping/rates', shippingRequest);

        if (response.data.code === 200 && response.data.result.length > 0) {
            // Find standard shipping or use first option
            const standardRate = response.data.result.find(
                (rate) => rate.id === 'STANDARD' || rate.name.toLowerCase().includes('standard')
            );
            const selectedRate = standardRate || response.data.result[0];

            logger.info(`Shipping calculated: ${selectedRate.name} - $${selectedRate.rate}`);
            return parseFloat(selectedRate.rate);
        }

        return 0;
    } catch (error) {
        logger.error('Shipping calculation failed:', error.response?.data || error.message);
        return 0;
    }
};

/**
 * Create an order in Printful
 * @param {Object} orderData - Complete order data
 * @returns {Promise<Object>} Result with success status and order data
 */
const createPrintfulOrder = async (orderData) => {
    try {
        const { items, shippingAddress, customer, orderNumber } = orderData;

        // Build order items with sync variant IDs or variant IDs
        const printfulItems = items.map((item) => {
            const itemData = {
                quantity: item.quantity,
            };

            // Use sync_variant_id if we have products synced with Printful
            if (item.variant?.printfulSyncVariantId || item.printfulSyncVariantId) {
                itemData.sync_variant_id =
                    item.variant?.printfulSyncVariantId || item.printfulSyncVariantId;
            } else if (item.variant?.printfulVariantId || item.printfulVariantId) {
                // Use catalog variant_id with files for on-the-fly orders
                itemData.variant_id = item.variant?.printfulVariantId || item.printfulVariantId;
                // Include print files if available
                if (item.product?.printFiles || item.printFiles) {
                    itemData.files = item.product?.printFiles || item.printFiles;
                }
            }

            return itemData;
        });

        const printfulOrderData = {
            external_id: orderNumber,
            shipping: 'STANDARD',
            recipient: {
                name: `${customer.firstName} ${customer.lastName}`,
                address1: shippingAddress.line1,
                address2: shippingAddress.line2 || '',
                city: shippingAddress.city,
                state_code: shippingAddress.state,
                country_code: shippingAddress.country || 'US',
                zip: shippingAddress.postalCode,
                phone: customer.phone || '',
                email: customer.email,
            },
            items: printfulItems,
        };

        // Add retail costs for packing slip if available
        if (orderData.subtotal) {
            printfulOrderData.retail_costs = {
                subtotal: orderData.subtotal.toFixed(2),
                shipping: (orderData.shippingCost || 0).toFixed(2),
            };
        }

        const response = await printfulClient.post('/orders', printfulOrderData, {
            params: { confirm: true }, // Auto-confirm order
        });

        if (response.data.code === 200) {
            logger.info(`Printful order created: ${response.data.result.id}`);
            return {
                success: true,
                printfulOrderId: response.data.result.id,
                data: response.data.result,
            };
        }

        return {
            success: false,
            error: 'Failed to create order',
        };
    } catch (error) {
        logger.error('Printful order creation failed:', error.response?.data || error.message);
        return {
            success: false,
            error: error.response?.data?.result || error.message,
        };
    }
};

/**
 * Get order status from Printful
 * @param {number|string} orderId - Printful order ID or external ID (prefixed with @)
 * @returns {Promise<Object|null>} Order data or null
 */
const getPrintfulOrderStatus = async (orderId) => {
    try {
        const response = await printfulClient.get(`/orders/${orderId}`);

        if (response.data.code === 200) {
            return response.data.result;
        }
        return null;
    } catch (error) {
        logger.error('Failed to get Printful order status:', error.response?.data || error.message);
        return null;
    }
};

/**
 * Estimate order costs without creating the order
 * @param {Object} orderData - Order data to estimate
 * @returns {Promise<Object|null>} Cost estimate or null
 */
const estimateOrderCosts = async (orderData) => {
    try {
        const { items, shippingAddress } = orderData;

        const estimateRequest = {
            shipping: 'STANDARD',
            recipient: {
                address1: shippingAddress.line1 || shippingAddress.address1,
                city: shippingAddress.city,
                state_code: shippingAddress.state,
                country_code: shippingAddress.country || 'US',
                zip: shippingAddress.postalCode || shippingAddress.zip,
            },
            items: items.map((item) => ({
                variant_id: item.variant?.printfulVariantId || item.printfulVariantId,
                quantity: item.quantity,
            })),
        };

        const response = await printfulClient.post('/orders/estimate-costs', estimateRequest);

        if (response.data.code === 200) {
            return response.data.result;
        }
        return null;
    } catch (error) {
        logger.error('Failed to estimate costs:', error.response?.data || error.message);
        return null;
    }
};

/**
 * Get store info to verify API connection
 * @returns {Promise<Object|null>} Store info or null
 */
const getStoreInfo = async () => {
    try {
        const response = await printfulClient.get('/stores');

        if (response.data.code === 200) {
            return response.data.result;
        }
        return null;
    } catch (error) {
        logger.error('Failed to get store info:', error.response?.data || error.message);
        return null;
    }
};

/**
 * Map Printful product category to local category
 * @param {string} printfulType - Printful product type
 * @returns {string} Local category
 */
const mapPrintfulCategory = (printfulType) => {
    const categoryMap = {
        'T-SHIRT': 'tshirts',
        SHIRT: 'tshirts',
        'TANK-TOP': 'tshirts',
        HOODIE: 'hoodies',
        SWEATSHIRT: 'sweatshirts',
        HAT: 'accessories',
        MUG: 'accessories',
        POSTER: 'accessories',
        STICKER: 'accessories',
        BAG: 'accessories',
        PHONE_CASE: 'accessories',
    };

    return categoryMap[printfulType?.toUpperCase()] || 'other';
};

/**
 * Map Printful size to local size format
 * @param {string} size - Printful size
 * @returns {string} Normalized size
 */
const normalizePrintfulSize = (size) => {
    const sizeMap = {
        'Extra Small': 'XS',
        Small: 'S',
        Medium: 'M',
        Large: 'L',
        'Extra Large': 'XL',
        '2X-Large': '2XL',
        '3X-Large': '3XL',
    };

    return sizeMap[size] || size;
};

module.exports = {
    printfulClient,
    getSyncProducts,
    getSyncProductDetails,
    getCatalogProduct,
    getCatalogVariant,
    calculatePrintfulShipping,
    createPrintfulOrder,
    getPrintfulOrderStatus,
    estimateOrderCosts,
    getStoreInfo,
    mapPrintfulCategory,
    normalizePrintfulSize,
};
