const { AnalyticsEvent, DailySummary } = require('../../../models/Analytics');
const Order = require('../../../models/Order');
const Product = require('../../../models/Product');
const { logger } = require('../../utils/logger');

/**
 * Get analytics dashboard overview
 */
exports.getDashboardOverview = async (req, res) => {
    try {
        const { period = '7d' } = req.query;

        // Calculate date range
        const endDate = new Date();
        let startDate = new Date();

        switch (period) {
            case '24h':
                startDate.setHours(startDate.getHours() - 24);
                break;
            case '7d':
                startDate.setDate(startDate.getDate() - 7);
                break;
            case '30d':
                startDate.setDate(startDate.getDate() - 30);
                break;
            case '90d':
                startDate.setDate(startDate.getDate() - 90);
                break;
            default:
                startDate.setDate(startDate.getDate() - 7);
        }

        // Get event counts
        const [pageViews, productViews, addToCarts, checkoutsCompleted, searches] =
            await Promise.all([
                AnalyticsEvent.countDocuments({
                    eventType: 'page_view',
                    createdAt: { $gte: startDate, $lte: endDate },
                }),
                AnalyticsEvent.countDocuments({
                    eventType: 'product_view',
                    createdAt: { $gte: startDate, $lte: endDate },
                }),
                AnalyticsEvent.countDocuments({
                    eventType: 'add_to_cart',
                    createdAt: { $gte: startDate, $lte: endDate },
                }),
                AnalyticsEvent.countDocuments({
                    eventType: 'checkout_completed',
                    createdAt: { $gte: startDate, $lte: endDate },
                }),
                AnalyticsEvent.countDocuments({
                    eventType: 'search',
                    createdAt: { $gte: startDate, $lte: endDate },
                }),
            ]);

        // Get unique visitors
        const uniqueVisitors = await AnalyticsEvent.distinct('visitorId', {
            createdAt: { $gte: startDate, $lte: endDate },
        });

        // Get revenue from orders
        const revenueData = await Order.aggregate([
            {
                $match: {
                    createdAt: { $gte: startDate, $lte: endDate },
                    'payment.status': 'completed',
                },
            },
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: '$total' },
                    orderCount: { $sum: 1 },
                },
            },
        ]);

        const revenue = revenueData[0]?.totalRevenue || 0;
        const orderCount = revenueData[0]?.orderCount || 0;
        const averageOrderValue = orderCount > 0 ? revenue / orderCount : 0;

        // Calculate conversion rate
        const conversionRate = uniqueVisitors.length > 0 ? (orderCount / uniqueVisitors.length) * 100 : 0;

        res.json({
            success: true,
            data: {
                period,
                startDate,
                endDate,
                metrics: {
                    pageViews,
                    uniqueVisitors: uniqueVisitors.length,
                    productViews,
                    addToCarts,
                    checkoutsCompleted,
                    searches,
                    revenue,
                    orderCount,
                    averageOrderValue,
                    conversionRate: conversionRate.toFixed(2),
                },
            },
        });
    } catch (error) {
        logger.error('Error getting analytics overview:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get analytics data',
        });
    }
};

/**
 * Get time series data for charts
 */
exports.getTimeSeriesData = async (req, res) => {
    try {
        const { period = '7d', metric = 'pageViews' } = req.query;

        const endDate = new Date();
        let startDate = new Date();
        let groupFormat;

        switch (period) {
            case '24h':
                startDate.setHours(startDate.getHours() - 24);
                groupFormat = { $hour: '$createdAt' };
                break;
            case '7d':
                startDate.setDate(startDate.getDate() - 7);
                groupFormat = { $dayOfMonth: '$createdAt' };
                break;
            case '30d':
                startDate.setDate(startDate.getDate() - 30);
                groupFormat = { $dayOfMonth: '$createdAt' };
                break;
            case '90d':
                startDate.setDate(startDate.getDate() - 90);
                groupFormat = { $week: '$createdAt' };
                break;
            default:
                startDate.setDate(startDate.getDate() - 7);
                groupFormat = { $dayOfMonth: '$createdAt' };
        }

        // Map metric to event type
        const eventTypeMap = {
            pageViews: 'page_view',
            productViews: 'product_view',
            addToCarts: 'add_to_cart',
            checkouts: 'checkout_completed',
            searches: 'search',
        };

        const eventType = eventTypeMap[metric] || 'page_view';

        const data = await AnalyticsEvent.aggregate([
            {
                $match: {
                    eventType,
                    createdAt: { $gte: startDate, $lte: endDate },
                },
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' },
                        day: { $dayOfMonth: '$createdAt' },
                    },
                    count: { $sum: 1 },
                    date: { $first: '$createdAt' },
                },
            },
            { $sort: { date: 1 } },
        ]);

        // Fill in missing dates with zeros
        const filledData = fillMissingDates(data, startDate, endDate);

        res.json({
            success: true,
            data: {
                period,
                metric,
                series: filledData,
            },
        });
    } catch (error) {
        logger.error('Error getting time series data:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get time series data',
        });
    }
};

/**
 * Get top products analytics
 */
exports.getTopProducts = async (req, res) => {
    try {
        const { period = '7d', limit = 10 } = req.query;

        const endDate = new Date();
        let startDate = new Date();

        switch (period) {
            case '24h':
                startDate.setHours(startDate.getHours() - 24);
                break;
            case '7d':
                startDate.setDate(startDate.getDate() - 7);
                break;
            case '30d':
                startDate.setDate(startDate.getDate() - 30);
                break;
            default:
                startDate.setDate(startDate.getDate() - 7);
        }

        // Get top viewed products
        const topViewed = await AnalyticsEvent.aggregate([
            {
                $match: {
                    eventType: 'product_view',
                    createdAt: { $gte: startDate, $lte: endDate },
                    productId: { $exists: true, $ne: null },
                },
            },
            {
                $group: {
                    _id: '$productId',
                    name: { $first: '$productName' },
                    category: { $first: '$productCategory' },
                    views: { $sum: 1 },
                },
            },
            { $sort: { views: -1 } },
            { $limit: parseInt(limit) },
        ]);

        // Get top added to cart
        const topAddedToCart = await AnalyticsEvent.aggregate([
            {
                $match: {
                    eventType: 'add_to_cart',
                    createdAt: { $gte: startDate, $lte: endDate },
                    productId: { $exists: true, $ne: null },
                },
            },
            {
                $group: {
                    _id: '$productId',
                    name: { $first: '$productName' },
                    category: { $first: '$productCategory' },
                    addToCarts: { $sum: 1 },
                    totalQuantity: { $sum: '$quantity' },
                },
            },
            { $sort: { addToCarts: -1 } },
            { $limit: parseInt(limit) },
        ]);

        res.json({
            success: true,
            data: {
                topViewed,
                topAddedToCart,
            },
        });
    } catch (error) {
        logger.error('Error getting top products:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get top products',
        });
    }
};

/**
 * Get traffic sources breakdown
 */
exports.getTrafficSources = async (req, res) => {
    try {
        const { period = '7d' } = req.query;

        const endDate = new Date();
        let startDate = new Date();

        switch (period) {
            case '24h':
                startDate.setHours(startDate.getHours() - 24);
                break;
            case '7d':
                startDate.setDate(startDate.getDate() - 7);
                break;
            case '30d':
                startDate.setDate(startDate.getDate() - 30);
                break;
            default:
                startDate.setDate(startDate.getDate() - 7);
        }

        const sources = await AnalyticsEvent.aggregate([
            {
                $match: {
                    eventType: 'page_view',
                    createdAt: { $gte: startDate, $lte: endDate },
                },
            },
            {
                $project: {
                    source: {
                        $cond: [
                            { $or: [{ $eq: ['$referrer', null] }, { $eq: ['$referrer', ''] }] },
                            'direct',
                            {
                                $cond: [
                                    {
                                        $regexMatch: {
                                            input: { $ifNull: ['$referrer', ''] },
                                            regex: /google|bing|yahoo|duckduckgo/i,
                                        },
                                    },
                                    'organic',
                                    {
                                        $cond: [
                                            {
                                                $regexMatch: {
                                                    input: { $ifNull: ['$referrer', ''] },
                                                    regex: /facebook|instagram|twitter|tiktok|pinterest/i,
                                                },
                                            },
                                            'social',
                                            'referral',
                                        ],
                                    },
                                ],
                            },
                        ],
                    },
                },
            },
            {
                $group: {
                    _id: '$source',
                    count: { $sum: 1 },
                },
            },
        ]);

        const sourcesMap = { direct: 0, organic: 0, social: 0, referral: 0 };
        sources.forEach((s) => {
            sourcesMap[s._id] = s.count;
        });

        res.json({
            success: true,
            data: sourcesMap,
        });
    } catch (error) {
        logger.error('Error getting traffic sources:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get traffic sources',
        });
    }
};

/**
 * Get device breakdown
 */
exports.getDeviceBreakdown = async (req, res) => {
    try {
        const { period = '7d' } = req.query;

        const endDate = new Date();
        let startDate = new Date();

        switch (period) {
            case '24h':
                startDate.setHours(startDate.getHours() - 24);
                break;
            case '7d':
                startDate.setDate(startDate.getDate() - 7);
                break;
            case '30d':
                startDate.setDate(startDate.getDate() - 30);
                break;
            default:
                startDate.setDate(startDate.getDate() - 7);
        }

        const devices = await AnalyticsEvent.aggregate([
            {
                $match: {
                    eventType: 'page_view',
                    createdAt: { $gte: startDate, $lte: endDate },
                },
            },
            {
                $group: {
                    _id: '$deviceType',
                    count: { $sum: 1 },
                },
            },
        ]);

        const devicesMap = { desktop: 0, mobile: 0, tablet: 0, unknown: 0 };
        devices.forEach((d) => {
            devicesMap[d._id || 'unknown'] = d.count;
        });

        res.json({
            success: true,
            data: devicesMap,
        });
    } catch (error) {
        logger.error('Error getting device breakdown:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get device breakdown',
        });
    }
};

/**
 * Get recent search queries
 */
exports.getRecentSearches = async (req, res) => {
    try {
        const { limit = 20 } = req.query;

        const searches = await AnalyticsEvent.aggregate([
            { $match: { eventType: 'search' } },
            {
                $group: {
                    _id: '$searchQuery',
                    count: { $sum: 1 },
                    lastSearched: { $max: '$createdAt' },
                },
            },
            { $sort: { count: -1 } },
            { $limit: parseInt(limit) },
        ]);

        res.json({
            success: true,
            data: searches,
        });
    } catch (error) {
        logger.error('Error getting recent searches:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get recent searches',
        });
    }
};

/**
 * Get promotion analytics
 */
exports.getPromotionAnalytics = async (req, res) => {
    try {
        const { period = '30d' } = req.query;

        const endDate = new Date();
        let startDate = new Date();

        switch (period) {
            case '7d':
                startDate.setDate(startDate.getDate() - 7);
                break;
            case '30d':
                startDate.setDate(startDate.getDate() - 30);
                break;
            case '90d':
                startDate.setDate(startDate.getDate() - 90);
                break;
            default:
                startDate.setDate(startDate.getDate() - 30);
        }

        const promotions = await AnalyticsEvent.aggregate([
            {
                $match: {
                    eventType: 'promotion_applied',
                    createdAt: { $gte: startDate, $lte: endDate },
                },
            },
            {
                $group: {
                    _id: '$promotionCode',
                    uses: { $sum: 1 },
                    totalDiscount: { $sum: '$discountAmount' },
                },
            },
            { $sort: { uses: -1 } },
        ]);

        const totalPromotionUses = promotions.reduce((sum, p) => sum + p.uses, 0);
        const totalDiscountGiven = promotions.reduce((sum, p) => sum + p.totalDiscount, 0);

        res.json({
            success: true,
            data: {
                promotions,
                summary: {
                    totalUses: totalPromotionUses,
                    totalDiscount: totalDiscountGiven,
                },
            },
        });
    } catch (error) {
        logger.error('Error getting promotion analytics:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get promotion analytics',
        });
    }
};

// Helper function to fill missing dates
function fillMissingDates(data, startDate, endDate) {
    const result = [];
    const dataMap = new Map();

    data.forEach((item) => {
        const dateKey = `${item._id.year}-${item._id.month}-${item._id.day}`;
        dataMap.set(dateKey, item.count);
    });

    const current = new Date(startDate);
    while (current <= endDate) {
        const dateKey = `${current.getFullYear()}-${current.getMonth() + 1}-${current.getDate()}`;
        result.push({
            date: new Date(current),
            label: current.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            value: dataMap.get(dateKey) || 0,
        });
        current.setDate(current.getDate() + 1);
    }

    return result;
}
