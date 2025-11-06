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
                    enum: ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'],
                    required: true,
                },
                color: String,
                sku: String,
                stock: {
                    type: Number,
                    default: 0,
                    min: 0,
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

productSchema.index({ slug: 1 });
productSchema.index({ category: 1, isActive: 1 });
productSchema.index({ tags: 1 });

module.exports = mongoose.model('Product', productSchema);
