const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        slug: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
        },
        description: {
            type: String,
            required: true,
        },
        price: {
            type: Number,
            required: true,
            min: 0,
        },
        compareAtPrice: {
            type: Number,
            min: 0,
        },
        images: [
            {
                url: {
                    type: String,
                    required: true,
                },
                alt: String,
                isPrimary: {
                    type: Boolean,
                    default: false,
                },
            },
        ],
        category: {
            type: String,
            required: true,
            enum: ['tshirts', 'hoodies', 'sweatshirts', 'accessories', 'other'],
        },
        tags: [String],
        variants: [
            {
                size: {
                    type: String,
                    enum: ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', 'One Size'],
                    required: true,
                },
                color: String,
                sku: String,
                stock: {
                    type: Number,
                    default: 0,
                    min: 0,
                },
                printfulVariantId: {
                    type: Number,
                    index: true,
                },
                printfulSyncVariantId: {
                    type: Number,
                    index: true,
                },
                // Printful cost data
                printfulCost: {
                    type: Number,
                    default: 0,
                },
                printfulRetailPrice: {
                    type: Number,
                    default: 0,
                },
            },
        ],
        // Aggregated cost info (for display)
        printfulBaseCost: {
            type: Number,
            default: 0,
        },
        printfulSyncProductId: {
            type: Number,
            index: true,
            sparse: true,
        },
        printfulExternalId: {
            type: String,
            index: true,
            sparse: true,
        },
        printFiles: [
            {
                type: {
                    type: String,
                    enum: ['default', 'front', 'back', 'preview', 'label_inside'],
                },
                url: String,
                position: {
                    area_width: Number,
                    area_height: Number,
                    width: Number,
                    height: Number,
                    top: Number,
                    left: Number,
                },
            },
        ],
        printifyProductId: String,
        printifyBlueprintId: String,
        seo: {
            title: String,
            description: String,
            keywords: [String],
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        isFeatured: {
            type: Boolean,
            default: false,
        },
        salesCount: {
            type: Number,
            default: 0,
        },
        viewCount: {
            type: Number,
            default: 0,
        },
    },
    {
        timestamps: true,
    }
);

// Indexes
productSchema.index({ category: 1, isActive: 1 });
productSchema.index({ tags: 1 });

// Virtual to check if product is synced with Printful
productSchema.virtual('isPrintfulSynced').get(function () {
    return !!this.printfulSyncProductId;
});

// Virtual to check if product can be purchased (synced and active)
productSchema.virtual('canPurchase').get(function () {
    return this.isActive && !!this.printfulSyncProductId;
});

// Method to get Printful variant by size
productSchema.methods.getPrintfulVariant = function (size) {
    return this.variants.find((v) => v.size === size && v.printfulSyncVariantId);
};

// Method to get Printful variant by size and color
productSchema.methods.getPrintfulVariantByDetails = function (size, color) {
    return this.variants.find(
        (v) => v.size === size && v.color === color && v.printfulSyncVariantId
    );
};

// Method to validate if a specific variant can be purchased
productSchema.methods.canPurchaseVariant = function (size, color) {
    if (!this.isActive || !this.printfulSyncProductId) return false;
    const variant = this.variants.find((v) => v.size === size && (!color || v.color === color));
    return variant && !!variant.printfulSyncVariantId;
};

// Static method to find by Printful sync product ID
productSchema.statics.findByPrintfulId = function (printfulSyncProductId) {
    return this.findOne({ printfulSyncProductId });
};

// Static method to find by Printful sync variant ID
productSchema.statics.findByPrintfulVariantId = function (printfulSyncVariantId) {
    return this.findOne({
        'variants.printfulSyncVariantId': printfulSyncVariantId,
    });
};

// Static method to find only purchasable (Printful-synced, active) products
productSchema.statics.findPurchasable = function (query = {}) {
    return this.find({
        ...query,
        isActive: true,
        printfulSyncProductId: { $exists: true, $ne: null },
    });
};

// Static method to find featured purchasable products
productSchema.statics.findFeaturedPurchasable = function (limit = 8) {
    return this.find({
        isActive: true,
        isFeatured: true,
        printfulSyncProductId: { $exists: true, $ne: null },
    }).limit(limit);
};

// Static method to find purchasable products by category
productSchema.statics.findPurchasableByCategory = function (category, options = {}) {
    const query = {
        isActive: true,
        printfulSyncProductId: { $exists: true, $ne: null },
    };

    if (category && category !== 'all') {
        query.category = category;
    }

    let dbQuery = this.find(query);

    if (options.sort) {
        dbQuery = dbQuery.sort(options.sort);
    }

    if (options.limit) {
        dbQuery = dbQuery.limit(options.limit);
    }

    if (options.skip) {
        dbQuery = dbQuery.skip(options.skip);
    }

    return dbQuery;
};

// Static method to count purchasable products
productSchema.statics.countPurchasable = function (query = {}) {
    return this.countDocuments({
        ...query,
        isActive: true,
        printfulSyncProductId: { $exists: true, $ne: null },
    });
};

// Static method to validate cart items can be purchased
productSchema.statics.validateCartForPurchase = async function (cartItems) {
    const errors = [];

    for (const item of cartItems) {
        const product = await this.findById(item.product._id || item.product);

        if (!product) {
            errors.push({
                item,
                error: 'Product not found',
            });
            continue;
        }

        if (!product.isActive) {
            errors.push({
                item,
                productName: product.name,
                error: 'Product is no longer available',
            });
            continue;
        }

        if (!product.printfulSyncProductId) {
            errors.push({
                item,
                productName: product.name,
                error: 'Product is not available for purchase',
            });
            continue;
        }

        // Validate the specific variant
        const variant = product.variants.find(
            (v) =>
                v.size === item.variant?.size &&
                (!item.variant?.color || v.color === item.variant?.color)
        );

        if (!variant) {
            errors.push({
                item,
                productName: product.name,
                error: `Variant ${item.variant?.size}/${item.variant?.color || 'default'} not found`,
            });
            continue;
        }

        if (!variant.printfulSyncVariantId) {
            errors.push({
                item,
                productName: product.name,
                error: `Variant ${item.variant?.size}/${item.variant?.color || 'default'} is not available for purchase`,
            });
        }
    }

    return {
        valid: errors.length === 0,
        errors,
    };
};

module.exports = mongoose.model('Product', productSchema);
