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
                // Printful-specific variant fields
                printfulVariantId: {
                    type: Number,
                    index: true,
                },
                printfulSyncVariantId: {
                    type: Number,
                    index: true,
                },
            },
        ],
        // Printful integration fields (replacing Printify fields)
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
        // Print files for Printful orders (used when ordering by catalog variant)
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
        // Legacy Printify fields (kept for migration compatibility)
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
productSchema.index({ slug: 1 });
productSchema.index({ category: 1, isActive: 1 });
productSchema.index({ tags: 1 });
productSchema.index({ printfulSyncProductId: 1 });
productSchema.index({ 'variants.printfulSyncVariantId': 1 });

// Virtual to check if product is synced with Printful
productSchema.virtual('isPrintfulSynced').get(function () {
    return !!this.printfulSyncProductId;
});

// Method to get Printful variant by size
productSchema.methods.getPrintfulVariant = function (size) {
    return this.variants.find((v) => v.size === size && v.printfulSyncVariantId);
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

module.exports = mongoose.model('Product', productSchema);
