const mongoose = require('mongoose');

/**
 * Analytics Event Schema
 * Tracks various events for analytics dashboard
 */
const analyticsEventSchema = new mongoose.Schema(
    {
        // Event type
        eventType: {
            type: String,
            required: true,
            enum: [
                'page_view',
                'product_view',
                'add_to_cart',
                'remove_from_cart',
                'checkout_started',
                'checkout_completed',
                'promotion_applied',
                'search',
            ],
            index: true,
        },

        // Session/visitor info
        sessionId: {
            type: String,
            index: true,
        },
        visitorId: {
            type: String,
            index: true,
        },

        // Page info
        page: String,
        referrer: String,

        // Product info (for product-related events)
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            index: true,
        },
        productName: String,
        productCategory: String,
        productPrice: Number,

        // Cart info
        quantity: Number,
        cartTotal: Number,

        // Order info
        orderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Order',
        },
        orderNumber: String,
        orderTotal: Number,

        // Promotion info
        promotionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Promotion',
        },
        promotionCode: String,
        discountAmount: Number,

        // Search info
        searchQuery: String,
        searchResultsCount: Number,

        // Device/browser info
        userAgent: String,
        deviceType: {
            type: String,
            enum: ['desktop', 'mobile', 'tablet', 'unknown'],
            default: 'unknown',
        },
        browser: String,
        os: String,

        // Location (derived from IP, optional)
        country: String,
        region: String,
        city: String,

        // Additional metadata
        metadata: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },
    },
    {
        timestamps: true,
    }
);

// Indexes for efficient queries
analyticsEventSchema.index({ createdAt: -1 });
analyticsEventSchema.index({ eventType: 1, createdAt: -1 });
analyticsEventSchema.index({ productId: 1, eventType: 1, createdAt: -1 });

/**
 * Daily Analytics Summary Schema
 * Pre-aggregated daily stats for faster dashboard queries
 */
const dailySummarySchema = new mongoose.Schema(
    {
        date: {
            type: Date,
            required: true,
            unique: true,
            index: true,
        },

        // Traffic
        pageViews: { type: Number, default: 0 },
        uniqueVisitors: { type: Number, default: 0 },
        sessions: { type: Number, default: 0 },

        // Product engagement
        productViews: { type: Number, default: 0 },
        uniqueProductsViewed: { type: Number, default: 0 },

        // Cart
        addToCarts: { type: Number, default: 0 },
        removeFromCarts: { type: Number, default: 0 },
        cartAbandonment: { type: Number, default: 0 },

        // Orders
        checkoutsStarted: { type: Number, default: 0 },
        checkoutsCompleted: { type: Number, default: 0 },
        conversionRate: { type: Number, default: 0 },

        // Revenue
        revenue: { type: Number, default: 0 },
        averageOrderValue: { type: Number, default: 0 },

        // Promotions
        promotionsApplied: { type: Number, default: 0 },
        totalDiscount: { type: Number, default: 0 },

        // Search
        searches: { type: Number, default: 0 },

        // Top products
        topProducts: [
            {
                productId: mongoose.Schema.Types.ObjectId,
                name: String,
                views: Number,
                addToCarts: Number,
                purchases: Number,
            },
        ],

        // Top categories
        topCategories: [
            {
                category: String,
                views: Number,
                purchases: Number,
            },
        ],

        // Traffic sources (simplified)
        trafficSources: {
            direct: { type: Number, default: 0 },
            organic: { type: Number, default: 0 },
            referral: { type: Number, default: 0 },
            social: { type: Number, default: 0 },
        },

        // Device breakdown
        devices: {
            desktop: { type: Number, default: 0 },
            mobile: { type: Number, default: 0 },
            tablet: { type: Number, default: 0 },
        },
    },
    {
        timestamps: true,
    }
);

// Static methods for Analytics Event
analyticsEventSchema.statics.trackEvent = async function (eventData) {
    try {
        const event = await this.create(eventData);
        return event;
    } catch (error) {
        console.error('Error tracking analytics event:', error);
        return null;
    }
};

analyticsEventSchema.statics.getEventCounts = async function (eventType, startDate, endDate) {
    const match = { eventType };
    if (startDate || endDate) {
        match.createdAt = {};
        if (startDate) match.createdAt.$gte = startDate;
        if (endDate) match.createdAt.$lte = endDate;
    }

    const result = await this.aggregate([{ $match: match }, { $count: 'count' }]);

    return result[0]?.count || 0;
};

analyticsEventSchema.statics.getTopProducts = async function (startDate, endDate, limit = 10) {
    const match = { eventType: 'product_view' };
    if (startDate || endDate) {
        match.createdAt = {};
        if (startDate) match.createdAt.$gte = startDate;
        if (endDate) match.createdAt.$lte = endDate;
    }

    return this.aggregate([
        { $match: match },
        {
            $group: {
                _id: '$productId',
                name: { $first: '$productName' },
                views: { $sum: 1 },
            },
        },
        { $sort: { views: -1 } },
        { $limit: limit },
    ]);
};

// Static methods for Daily Summary
dailySummarySchema.statics.getOrCreate = async function (date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    let summary = await this.findOne({ date: startOfDay });

    if (!summary) {
        summary = await this.create({ date: startOfDay });
    }

    return summary;
};

dailySummarySchema.statics.getRange = async function (startDate, endDate) {
    return this.find({
        date: {
            $gte: startDate,
            $lte: endDate,
        },
    }).sort({ date: 1 });
};

const AnalyticsEvent = mongoose.model('AnalyticsEvent', analyticsEventSchema);
const DailySummary = mongoose.model('DailySummary', dailySummarySchema);

module.exports = {
    AnalyticsEvent,
    DailySummary,
};
