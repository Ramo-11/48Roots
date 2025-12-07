// services/printfulService.js
const axios = require('axios');
const { logger } = require('../utils/logger');
require('dotenv').config();

/* ============================================================
   PRINTFUL CLIENT (Axios)
============================================================ */
const printfulClient = axios.create({
    baseURL: 'https://api.printful.com/v2',
    headers: {
        Authorization: `Bearer ${process.env.PRINTFUL_API_TOKEN}`,
        'Content-Type': 'application/json',
        'X-PF-Store-Id': process.env.PRINTFUL_STORE_ID,
    },
    timeout: 30000,
});

// Log failed responses
printfulClient.interceptors.response.use(
    (res) => {
        return res;
    },
    (err) => {
        if (err.response) {
            const { status, data, headers } = err.response;

            logger.error('Printful API Error:');
            logger.error(`Status: ${status}`);
            logger.error(`URL: ${err.config?.url}`);

            // Safe logging of data (non-circular)
            try {
                logger.error(`Response Data: ${JSON.stringify(data, null, 2)}`);
            } catch {
                logger.error('Response Data (raw):', data);
            }

            // Optionally log headers
            try {
                logger.error(`Headers: ${JSON.stringify(headers, null, 2)}`);
            } catch {
                logger.error('Headers (raw):', headers);
            }
        } else {
            logger.error('Printful API Network Error:', err.message);
        }

        return Promise.reject(err);
    }
);

/* ============================================================
   API HELPERS
============================================================ */

/** Wrapper for GET */
async function get(endpoint, params = {}) {
    const res = await printfulClient.get(endpoint, { params });
    return res.data.result;
}

/** Wrapper for POST */
async function post(endpoint, body = {}, params = {}) {
    const res = await printfulClient.post(endpoint, body, { params });
    return res.data.result;
}

/* ============================================================
   GET STORE INFO
============================================================ */
async function getStoreInfo() {
    try {
        const res = await printfulClient.get('/stores');
        // V2 uses 'data' not 'result'
        return res.data.data || [];
    } catch (err) {
        logger.error('Error in getStoreInfo:', err.response?.data || err);
        return [];
    }
}

/* ============================================================
   SYNC PRODUCTS
============================================================ */
const printfulClientV1 = axios.create({
    baseURL: 'https://api.printful.com', // V1 base URL (no /v2)
    headers: {
        Authorization: `Bearer ${process.env.PRINTFUL_API_TOKEN}`,
        'Content-Type': 'application/json',
        'X-PF-Store-Id': process.env.PRINTFUL_STORE_ID,
    },
    timeout: 30000,
});

async function getSyncProducts() {
    try {
        const products = [];
        let offset = 0;
        const limit = 100;
        let more = true;

        while (more) {
            const response = await printfulClientV1.get('/sync/products', {
                params: { offset, limit },
            });

            if (response.data.code === 200) {
                products.push(...response.data.result);
                const paging = response.data.paging;
                more = paging && offset + limit < paging.total;
                offset += limit;
            } else {
                more = false;
            }
        }

        logger.info(`Retrieved ${products.length} synced products`);
        return products;
    } catch (err) {
        logger.error('Failed to fetch sync products:', err.message);
        return [];
    }
}

/* ============================================================
   SYNC PRODUCT DETAILS (WITH VARIANTS)
============================================================ */
async function getSyncProductDetails(syncProductId) {
    try {
        // Use V1 endpoint
        const response = await printfulClientV1.get(`/sync/products/${syncProductId}`);
        if (response.data.code === 200) return response.data.result;
        return null;
    } catch (err) {
        logger.error(`Failed to fetch product ${syncProductId}:`, err.message);
        return null;
    }
}

/* ============================================================
   CATALOG QUERIES (PRODUCT + VARIANT)
============================================================ */
async function getCatalogProduct(productId) {
    try {
        const res = await get(`/products/${productId}`);
        return res;
    } catch {
        return null;
    }
}

async function getCatalogVariant(variantId) {
    try {
        const res = await get(`/products/variant/${variantId}`);
        return res;
    } catch {
        return null;
    }
}

/* ============================================================
   SHIPPING
============================================================ */
async function calculatePrintfulShipping(items, address) {
    try {
        const req = {
            recipient: {
                address1: address.line1 || address.address1,
                city: address.city,
                state_code: address.state,
                zip: address.postalCode || address.zip,
                country_code: address.country || 'US',
            },
            items: items.map((item) => ({
                quantity: item.quantity,
                variant_id: item.variant?.printfulVariantId || item.printfulVariantId,
                sync_variant_id: item.variant?.printfulSyncVariantId || item.printfulSyncVariantId,
            })),
        };

        const response = await post('/shipping/rates', req);

        if (response && response.length > 0) {
            const standard =
                response.find((r) => r.id === 'STANDARD') ||
                response.find((r) => r.name.toLowerCase().includes('standard')) ||
                response[0];

            return parseFloat(standard.rate) || 0;
        }

        return 0;
    } catch (err) {
        logger.error('Shipping calculation failed:', err.message);
        return 0;
    }
}

/* ============================================================
   ORDER CREATION
============================================================ */
async function createPrintfulOrder(orderData) {
    try {
        const { items, shippingAddress, customer, orderNumber, subtotal, shippingCost } = orderData;

        const printfulItems = items.map((item) => {
            const base = { quantity: item.quantity };

            if (item.variant?.printfulSyncVariantId || item.printfulSyncVariantId) {
                base.sync_variant_id =
                    item.variant?.printfulSyncVariantId || item.printfulSyncVariantId;
            } else {
                base.variant_id = item.variant?.printfulVariantId || item.printfulVariantId;

                if (item.product?.printFiles || item.printFiles) {
                    base.files = item.product?.printFiles || item.printFiles;
                }
            }

            return base;
        });

        const body = {
            external_id: orderNumber,
            shipping: 'STANDARD',
            recipient: {
                name: `${customer.firstName} ${customer.lastName}`,
                address1: shippingAddress.line1,
                address2: shippingAddress.line2 ?? '',
                city: shippingAddress.city,
                state_code: shippingAddress.state,
                country_code: shippingAddress.country || 'US',
                zip: shippingAddress.postalCode,
                email: customer.email,
                phone: customer.phone || '',
            },
            items: printfulItems,
        };

        if (subtotal) {
            body.retail_costs = {
                subtotal: subtotal.toFixed(2),
                shipping: (shippingCost || 0).toFixed(2),
            };
        }

        const response = await post('/orders', body, { confirm: true });

        return {
            success: true,
            printfulOrderId: response.id,
            data: response,
        };
    } catch (err) {
        logger.error('Printful order creation failed:', err.message);
        return { success: false, error: err.message };
    }
}

/* ============================================================
   ORDER STATUS
============================================================ */
async function getPrintfulOrderStatus(orderId) {
    try {
        const response = await get(`/orders/${orderId}`);
        return response;
    } catch (err) {
        logger.error(`Failed to fetch order status: ${orderId}`, err.message);
        return null;
    }
}

/* ============================================================
   ESTIMATE ORDER COSTS
============================================================ */
async function estimateOrderCosts(orderData) {
    try {
        const response = await post('/orders/estimate-costs', orderData);
        return response;
    } catch (err) {
        logger.error('Estimate cost failed:', err.message);
        return null;
    }
}

/* ============================================================
   CATEGORY + SIZE HELPERS
============================================================ */
function mapPrintfulCategory(type) {
    const map = {
        'T-SHIRT': 'tshirts',
        SHIRT: 'tshirts',
        HOODIE: 'hoodies',
        SWEATSHIRT: 'sweatshirts',
        HAT: 'accessories',
        MUG: 'accessories',
        POSTER: 'accessories',
        STICKER: 'accessories',
    };

    return map[type?.toUpperCase()] || 'other';
}

function normalizePrintfulSize(size) {
    const map = {
        'EXTRA SMALL': 'XS',
        SMALL: 'S',
        MEDIUM: 'M',
        LARGE: 'L',
        'EXTRA LARGE': 'XL',
        '2X-LARGE': '2XL',
        '3X-LARGE': '3XL',
    };

    return map[size] || size;
}

/* ============================================================
   EXPORTS
============================================================ */
module.exports = {
    printfulClient,
    printfulClientV1,
    getStoreInfo,
    getSyncProducts,
    getSyncProductDetails,
    getCatalogProduct,
    getCatalogVariant,
    calculatePrintfulShipping,
    createPrintfulOrder,
    getPrintfulOrderStatus,
    estimateOrderCosts,
    mapPrintfulCategory,
    normalizePrintfulSize,
};
