const Order = require('../../models/Order');
const { logger } = require('../utils/logger');
const { getPrintfulOrderStatus } = require('../config/printful');

/**
 * Get order status for order confirmation page
 */
exports.getOrderStatus = async (req, res) => {
    try {
        const { orderNumber } = req.params;

        const order = await Order.findOne({ orderNumber }).populate('items.product').lean();

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found',
            });
        }

        // If order has Printful ID, fetch latest status
        if (order.fulfillment?.printfulOrderId) {
            try {
                const printfulOrder = await getPrintfulOrderStatus(
                    order.fulfillment.printfulOrderId
                );

                if (printfulOrder) {
                    // Update local order with Printful data
                    const dbOrder = await Order.findOne({ orderNumber });
                    await dbOrder.updateFromPrintful(printfulOrder);

                    // Get fresh data
                    const updatedOrder = await Order.findOne({ orderNumber }).lean();

                    return res.json({
                        success: true,
                        data: formatOrderForClient(updatedOrder, printfulOrder),
                    });
                }
            } catch (printfulError) {
                logger.error('Error fetching Printful order status:', printfulError);
                // Continue with cached data
            }
        }

        res.json({
            success: true,
            data: formatOrderForClient(order),
        });
    } catch (error) {
        logger.error('Error getting order status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get order status',
        });
    }
};

/**
 * Format order data for client
 */
function formatOrderForClient(order, printfulOrder = null) {
    const response = {
        orderNumber: order.orderNumber,
        status: getFriendlyStatus(order.fulfillment?.status),
        paymentStatus: order.payment?.status,
        customer: {
            email: order.customer?.email,
            name: `${order.customer?.firstName} ${order.customer?.lastName}`,
        },
        shippingAddress: order.shippingAddress,
        items: order.items?.map((item) => ({
            name: item.productSnapshot?.name || item.product?.name,
            image: item.productSnapshot?.image || item.product?.images?.[0]?.url,
            variant: item.variant,
            quantity: item.quantity,
            price: item.price,
            subtotal: item.subtotal,
        })),
        subtotal: order.subtotal,
        shipping: order.shipping?.cost,
        donation: order.donation?.amount,
        total: order.total,
        tracking: null,
        estimatedDelivery: null,
        createdAt: order.createdAt,
    };

    // Add tracking info if available
    if (order.fulfillment?.trackingNumber) {
        response.tracking = {
            number: order.fulfillment.trackingNumber,
            carrier: order.fulfillment.carrier,
            url:
                order.fulfillment.trackingUrl ||
                getTrackingUrl(order.fulfillment.carrier, order.fulfillment.trackingNumber),
        };
    }

    // Add shipments from Printful if available
    if (printfulOrder?.shipments?.length > 0) {
        const shipment = printfulOrder.shipments[0];
        response.tracking = {
            number: shipment.tracking_number,
            carrier: shipment.carrier,
            url:
                shipment.tracking_url || getTrackingUrl(shipment.carrier, shipment.tracking_number),
        };

        if (shipment.ship_date) {
            response.shippedAt = shipment.ship_date;
        }
    }

    return response;
}

/**
 * Get friendly status name
 */
function getFriendlyStatus(status) {
    const statusMap = {
        pending: 'Order Received',
        processing: 'Being Prepared',
        shipped: 'Shipped',
        delivered: 'Delivered',
        cancelled: 'Cancelled',
        on_hold: 'On Hold',
        failed: 'Issue with Order',
    };

    return statusMap[status] || 'Processing';
}

/**
 * Generate tracking URL based on carrier
 */
function getTrackingUrl(carrier, trackingNumber) {
    if (!carrier || !trackingNumber) return null;

    const carrierUrls = {
        USPS: `https://tools.usps.com/go/TrackConfirmAction?tLabels=${trackingNumber}`,
        UPS: `https://www.ups.com/track?tracknum=${trackingNumber}`,
        FEDEX: `https://www.fedex.com/fedextrack/?trknbr=${trackingNumber}`,
        DHL: `https://www.dhl.com/en/express/tracking.html?AWB=${trackingNumber}`,
    };

    return carrierUrls[carrier.toUpperCase()] || null;
}

/**
 * Manually refresh order status from Printful
 */
exports.refreshOrderStatus = async (req, res) => {
    try {
        const { orderNumber } = req.params;

        const order = await Order.findOne({ orderNumber });

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found',
            });
        }

        if (!order.fulfillment?.printfulOrderId) {
            return res.status(400).json({
                success: false,
                message: 'Order is not associated with Printful',
            });
        }

        const printfulOrder = await getPrintfulOrderStatus(order.fulfillment.printfulOrderId);

        if (!printfulOrder) {
            return res.status(500).json({
                success: false,
                message: 'Failed to fetch order from Printful',
            });
        }

        await order.updateFromPrintful(printfulOrder);

        res.json({
            success: true,
            message: 'Order status refreshed',
            data: formatOrderForClient(order.toObject(), printfulOrder),
        });
    } catch (error) {
        logger.error('Error refreshing order status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to refresh order status',
        });
    }
};
