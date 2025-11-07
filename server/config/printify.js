const axios = require('axios');
const { logger } = require('../utils/logger');
require('dotenv').config();

const printifyClient = axios.create({
    baseURL: 'https://api.printify.com/v1',
    headers: {
        Authorization: `Bearer ${process.env.PRINTIFY_API_TOKEN}`,
        'Content-Type': 'application/json',
    },
});

const createPrintifyOrder = async (orderData) => {
    try {
        const { items, shippingAddress, customer } = orderData;

        const lineItems = items.map((item) => ({
            product_id: item.product.printifyProductId,
            variant_id: item.variant.printifyVariantId || item.product.printifyBlueprintId,
            quantity: item.quantity,
        }));

        const printifyOrderData = {
            external_id: orderData.orderNumber,
            label: orderData.orderNumber,
            line_items: lineItems,
            shipping_method: 1,
            send_shipping_notification: true,
            address_to: {
                first_name: customer.firstName,
                last_name: customer.lastName,
                email: customer.email,
                phone: customer.phone || '',
                country: shippingAddress.country,
                region: shippingAddress.state,
                address1: shippingAddress.line1,
                address2: shippingAddress.line2 || '',
                city: shippingAddress.city,
                zip: shippingAddress.postalCode,
            },
        };

        const response = await printifyClient.post(
            `/shops/${process.env.PRINTIFY_SHOP_ID}/orders.json`,
            printifyOrderData
        );

        logger.info(`Printify order created: ${response.data.id}`);
        return {
            success: true,
            printifyOrderId: response.data.id,
            data: response.data,
        };
    } catch (error) {
        logger.error('Printify order creation failed:', error.response?.data || error.message);
        return {
            success: false,
            error: error.response?.data || error.message,
        };
    }
};

const calculatePrintifyShipping = async (items, address) => {
    try {
        const lineItems = items.map((item) => ({
            product_id: item.product.printifyProductId,
            variant_id: item.variant.printifyVariantId || item.product.printifyBlueprintId,
            quantity: item.quantity,
        }));

        const response = await printifyClient.post(
            `/shops/${process.env.PRINTIFY_SHOP_ID}/orders/shipping.json`,
            {
                line_items: lineItems,
                address_to: {
                    country: address.country,
                    region: address.state,
                    city: address.city,
                    zip: address.postalCode,
                },
            }
        );

        const standardShipping = response.data.find((option) => option.is_default);
        return standardShipping ? standardShipping.cost / 100 : 0;
    } catch (error) {
        logger.error('Shipping calculation failed:', error.response?.data || error.message);
        return 0;
    }
};

const getPrintifyOrderStatus = async (printifyOrderId) => {
    try {
        const response = await printifyClient.get(
            `/shops/${process.env.PRINTIFY_SHOP_ID}/orders/${printifyOrderId}.json`
        );
        return response.data;
    } catch (error) {
        logger.error('Failed to get Printify order status:', error.response?.data || error.message);
        return null;
    }
};

module.exports = {
    createPrintifyOrder,
    calculatePrintifyShipping,
    getPrintifyOrderStatus,
};
