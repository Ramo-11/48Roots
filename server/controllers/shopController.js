const Product = require('../../models/Product');
const { logger } = require('../utils/logger');

// Base filter for purchasable products (synced with Printful)
const PURCHASABLE_FILTER = {
    isActive: true,
    printfulSyncProductId: { $exists: true, $ne: null },
};

exports.getProducts = async (req, res) => {
    try {
        const { categories, sizes, sort } = req.query;

        // Start with purchasable filter
        const filter = { ...PURCHASABLE_FILTER };

        if (categories) {
            const categoryArray = categories.split(',');
            filter.category = { $in: categoryArray };
        }

        if (sizes) {
            const sizeArray = sizes.split(',');
            filter['variants.size'] = { $in: sizeArray };
        }

        let sortOption = {};
        switch (sort) {
            case 'newest':
                sortOption = { createdAt: -1 };
                break;
            case 'price-low':
                sortOption = { price: 1 };
                break;
            case 'price-high':
                sortOption = { price: -1 };
                break;
            case 'featured':
            default:
                sortOption = { isFeatured: -1, createdAt: -1 };
                break;
        }

        const products = await Product.find(filter)
            .sort(sortOption)
            .select(
                'name slug description price compareAtPrice images category tags isFeatured variants'
            )
            .lean();

        res.json({
            success: true,
            data: products,
        });
    } catch (error) {
        logger.error('Error fetching products:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch products',
        });
    }
};

exports.getFeaturedProducts = async (req, res) => {
    try {
        const products = await Product.find({
            ...PURCHASABLE_FILTER,
            isFeatured: true,
        })
            .limit(8)
            .select('name slug description price compareAtPrice images category variants')
            .lean();

        res.json({
            success: true,
            data: products,
        });
    } catch (error) {
        logger.error('Error fetching featured products:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch featured products',
        });
    }
};

exports.getProductBySlug = async (req, res) => {
    try {
        const { slug } = req.params;

        // Only return if product is purchasable (synced with Printful)
        const product = await Product.findOne({
            slug,
            ...PURCHASABLE_FILTER,
        }).lean();

        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found',
            });
        }

        res.json({
            success: true,
            data: product,
        });
    } catch (error) {
        logger.error('Error fetching product by slug:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch product',
        });
    }
};

exports.getRelatedProducts = async (req, res) => {
    try {
        const { productId } = req.params;

        const product = await Product.findById(productId);

        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found',
            });
        }

        // Only return purchasable related products
        const relatedProducts = await Product.find({
            _id: { $ne: productId },
            category: product.category,
            ...PURCHASABLE_FILTER,
        })
            .limit(8)
            .select('name slug price compareAtPrice images category variants isFeatured')
            .lean();

        res.json({
            success: true,
            data: relatedProducts,
        });
    } catch (error) {
        logger.error('Error fetching related products:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch related products',
        });
    }
};
