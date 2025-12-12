const { AnalyticsEvent } = require('../../models/Analytics');
const { logger } = require('../utils/logger');
const UAParser = require('ua-parser-js');

/**
 * Track an analytics event (public endpoint)
 */
exports.trackEvent = async (req, res) => {
    try {
        const {
            eventType,
            sessionId,
            visitorId,
            page,
            referrer,
            productId,
            productName,
            productCategory,
            productPrice,
            quantity,
            cartTotal,
            orderId,
            orderNumber,
            orderTotal,
            promotionId,
            promotionCode,
            discountAmount,
            searchQuery,
            searchResultsCount,
            metadata,
        } = req.body;

        if (!eventType) {
            return res.status(400).json({
                success: false,
                message: 'Event type is required',
            });
        }

        // Parse user agent
        const userAgent = req.headers['user-agent'] || '';
        const parser = new UAParser(userAgent);
        const device = parser.getDevice();
        const browser = parser.getBrowser();
        const os = parser.getOS();

        let deviceType = 'unknown';
        if (device.type === 'mobile') deviceType = 'mobile';
        else if (device.type === 'tablet') deviceType = 'tablet';
        else if (!device.type || device.type === 'undefined') deviceType = 'desktop';

        const event = await AnalyticsEvent.create({
            eventType,
            sessionId: sessionId || req.sessionID,
            visitorId: visitorId || req.cookies?.visitorId,
            page,
            referrer: referrer || req.headers.referer,
            productId,
            productName,
            productCategory,
            productPrice,
            quantity,
            cartTotal,
            orderId,
            orderNumber,
            orderTotal,
            promotionId,
            promotionCode,
            discountAmount,
            searchQuery,
            searchResultsCount,
            userAgent,
            deviceType,
            browser: browser.name,
            os: os.name,
            metadata,
        });

        res.json({
            success: true,
            data: { eventId: event._id },
        });
    } catch (error) {
        logger.error('Error tracking analytics event:', error);
        // Don't fail the request - analytics should be non-blocking
        res.json({
            success: true,
            data: { eventId: null },
        });
    }
};

/**
 * Track page view (simplified endpoint)
 */
exports.trackPageView = async (req, res) => {
    try {
        const { page, referrer, visitorId, sessionId } = req.body;

        const userAgent = req.headers['user-agent'] || '';
        const parser = new UAParser(userAgent);
        const device = parser.getDevice();
        const browser = parser.getBrowser();
        const os = parser.getOS();

        let deviceType = 'unknown';
        if (device.type === 'mobile') deviceType = 'mobile';
        else if (device.type === 'tablet') deviceType = 'tablet';
        else if (!device.type || device.type === 'undefined') deviceType = 'desktop';

        await AnalyticsEvent.create({
            eventType: 'page_view',
            sessionId: sessionId || req.sessionID,
            visitorId: visitorId || req.cookies?.visitorId,
            page,
            referrer: referrer || req.headers.referer,
            userAgent,
            deviceType,
            browser: browser.name,
            os: os.name,
        });

        res.json({ success: true });
    } catch (error) {
        logger.error('Error tracking page view:', error);
        res.json({ success: true });
    }
};

/**
 * Track product view (simplified endpoint)
 */
exports.trackProductView = async (req, res) => {
    try {
        const { productId, productName, productCategory, productPrice, visitorId, sessionId } =
            req.body;

        const userAgent = req.headers['user-agent'] || '';
        const parser = new UAParser(userAgent);
        const device = parser.getDevice();

        let deviceType = 'unknown';
        if (device.type === 'mobile') deviceType = 'mobile';
        else if (device.type === 'tablet') deviceType = 'tablet';
        else if (!device.type || device.type === 'undefined') deviceType = 'desktop';

        await AnalyticsEvent.create({
            eventType: 'product_view',
            sessionId: sessionId || req.sessionID,
            visitorId: visitorId || req.cookies?.visitorId,
            productId,
            productName,
            productCategory,
            productPrice,
            userAgent,
            deviceType,
        });

        res.json({ success: true });
    } catch (error) {
        logger.error('Error tracking product view:', error);
        res.json({ success: true });
    }
};
