const Product = require('../../models/Product');
const { logger } = require('../utils/logger');

exports.searchProducts = async (req, res) => {
    try {
        const { q } = req.query;

        if (!q || q.trim().length < 2) {
            return res.json({
                success: true,
                data: [],
            });
        }

        const searchQuery = q.trim();

        const products = await Product.find({
            isActive: true,
            printfulSyncProductId: { $exists: true, $ne: null },
            $or: [
                { name: { $regex: searchQuery, $options: 'i' } },
                { description: { $regex: searchQuery, $options: 'i' } },
                { tags: { $regex: searchQuery, $options: 'i' } },
                { category: { $regex: searchQuery, $options: 'i' } },
            ],
        })
            .limit(20)
            .select('name slug price images category')
            .lean();

        res.json({
            success: true,
            data: products,
        });
    } catch (error) {
        logger.error('Error searching products:', error);
        res.status(500).json({
            success: false,
            message: 'Search failed',
        });
    }
};
