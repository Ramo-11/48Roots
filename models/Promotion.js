const mongoose = require('mongoose');

const promotionSchema = new mongoose.Schema(
    {
        // Basic info
        name: {
            type: String,
            required: true,
            trim: true,
        },
        code: {
            type: String,
            uppercase: true,
            trim: true,
            sparse: true,
            index: true,
        },
        description: {
            type: String,
            required: true,
        },

        // Promotion type and value
        type: {
            type: String,
            enum: ['percentage', 'fixed', 'free_shipping'],
            required: true,
        },
        value: {
            type: Number,
            required: true,
            min: 0,
        },

        // Scope: global (all products) or specific products/categories
        scope: {
            type: String,
            enum: ['global', 'products', 'categories'],
            default: 'global',
        },
        applicableProducts: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Product',
            },
        ],
        applicableCategories: [String],

        // Auto-apply vs code-required
        autoApply: {
            type: Boolean,
            default: false,
        },

        // Storefront visibility
        showBanner: {
            type: Boolean,
            default: false,
        },
        bannerText: {
            type: String,
            default: '',
        },
        bannerColor: {
            type: String,
            default: '#c41e3a', // Default red/sale color
        },

        // Conditions
        minPurchaseAmount: {
            type: Number,
            default: 0,
        },
        maxDiscountAmount: Number,

        // Usage limits
        usageLimit: {
            total: Number,
            perCustomer: {
                type: Number,
                default: 1,
            },
        },
        usageCount: {
            type: Number,
            default: 0,
        },

        // Validity period
        validFrom: {
            type: Date,
            required: true,
        },
        validUntil: {
            type: Date,
            required: true,
        },

        // Status
        isActive: {
            type: Boolean,
            default: true,
        },

        // Priority for stacking (higher = applied first)
        priority: {
            type: Number,
            default: 0,
        },
    },
    {
        timestamps: true,
    }
);

// Indexes
promotionSchema.index({ code: 1, isActive: 1 });
promotionSchema.index({ validFrom: 1, validUntil: 1 });
promotionSchema.index({ isActive: 1, autoApply: 1 });
promotionSchema.index({ scope: 1, isActive: 1 });

// Check if promotion is currently valid
promotionSchema.methods.isValid = function () {
    const now = new Date();
    return (
        this.isActive &&
        now >= this.validFrom &&
        now <= this.validUntil &&
        (!this.usageLimit?.total || this.usageCount < this.usageLimit.total)
    );
};

// Check if promotion applies to a specific product
promotionSchema.methods.appliesToProduct = function (product) {
    if (!this.isValid()) return false;

    if (this.scope === 'global') return true;

    if (this.scope === 'products') {
        const productId = product._id?.toString() || product.toString();
        return this.applicableProducts.some((p) => p.toString() === productId);
    }

    if (this.scope === 'categories') {
        return this.applicableCategories.includes(product.category);
    }

    return false;
};

// Calculate discount for a subtotal
promotionSchema.methods.calculateDiscount = function (subtotal, applicableSubtotal = null) {
    if (!this.isValid() || subtotal < this.minPurchaseAmount) {
        return 0;
    }

    // Use applicable subtotal if provided (for product-specific discounts)
    const discountBase = applicableSubtotal !== null ? applicableSubtotal : subtotal;

    let discount = 0;
    if (this.type === 'percentage') {
        discount = (discountBase * this.value) / 100;
    } else if (this.type === 'fixed') {
        discount = this.value;
    }

    if (this.maxDiscountAmount) {
        discount = Math.min(discount, this.maxDiscountAmount);
    }

    return Math.min(discount, subtotal);
};

// Calculate discounted price for a single product
promotionSchema.methods.getDiscountedPrice = function (originalPrice) {
    if (!this.isValid()) return originalPrice;

    if (this.type === 'percentage') {
        return originalPrice * (1 - this.value / 100);
    } else if (this.type === 'fixed') {
        return Math.max(0, originalPrice - this.value);
    }

    return originalPrice;
};

// Static: Find all active, auto-apply promotions
promotionSchema.statics.findAutoApply = function () {
    const now = new Date();
    return this.find({
        isActive: true,
        autoApply: true,
        validFrom: { $lte: now },
        validUntil: { $gte: now },
    }).sort({ priority: -1 });
};

// Static: Find active promotions with banner enabled
promotionSchema.statics.findWithBanner = function () {
    const now = new Date();
    return this.find({
        isActive: true,
        showBanner: true,
        validFrom: { $lte: now },
        validUntil: { $gte: now },
    }).sort({ priority: -1 });
};

// Static: Find promotion by code
promotionSchema.statics.findByCode = function (code) {
    return this.findOne({
        code: code.toUpperCase(),
        isActive: true,
    });
};

// Static: Find all promotions applicable to a product
promotionSchema.statics.findForProduct = async function (productId, category) {
    const now = new Date();
    const promotions = await this.find({
        isActive: true,
        autoApply: true,
        validFrom: { $lte: now },
        validUntil: { $gte: now },
        $or: [
            { scope: 'global' },
            { scope: 'products', applicableProducts: productId },
            { scope: 'categories', applicableCategories: category },
        ],
    }).sort({ priority: -1 });

    return promotions;
};

// Static: Get best promotion for a product (highest discount)
promotionSchema.statics.getBestForProduct = async function (productId, category, price) {
    const promotions = await this.findForProduct(productId, category);

    if (promotions.length === 0) return null;

    let bestPromotion = null;
    let bestDiscount = 0;

    for (const promo of promotions) {
        const discount = price - promo.getDiscountedPrice(price);
        if (discount > bestDiscount) {
            bestDiscount = discount;
            bestPromotion = promo;
        }
    }

    return bestPromotion;
};

module.exports = mongoose.model('Promotion', promotionSchema);
