const Product = require('../../models/Product');
const { logger } = require('../utils/logger');

exports.getProducts = async (req, res) => {
    try {
        const { categories, sizes, sort } = req.query;

        const filter = { isActive: true };

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
        const products = await Product.find({ isActive: true, isFeatured: true })
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

        const product = await Product.findOne({ slug, isActive: true }).lean();

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

        const relatedProducts = await Product.find({
            _id: { $ne: productId },
            category: product.category,
            isActive: true,
        })
            .limit(4)
            .select('name slug price images')
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
