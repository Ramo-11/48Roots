const Promotion = require('../../../models/Promotion');
const Product = require('../../../models/Product');
const { logger } = require('../../utils/logger');

/**
 * Get all promotions for admin
 */
exports.getPromotions = async (req, res) => {
    try {
        const promotions = await Promotion.find({})
            .populate('applicableProducts', 'name slug')
            .sort({ createdAt: -1 })
            .lean();

        const formattedPromotions = promotions.map((p) => ({
            _id: p._id,
            name: p.name,
            code: p.code,
            description: p.description,
            type: p.type,
            value: p.value,
            scope: p.scope,
            applicableProducts: p.applicableProducts,
            applicableCategories: p.applicableCategories,
            autoApply: p.autoApply,
            showBanner: p.showBanner,
            bannerText: p.bannerText,
            bannerColor: p.bannerColor,
            minPurchaseAmount: p.minPurchaseAmount,
            maxDiscountAmount: p.maxDiscountAmount,
            usageLimit: p.usageLimit,
            usageCount: p.usageCount,
            validFrom: p.validFrom,
            validUntil: p.validUntil,
            isActive: p.isActive,
            priority: p.priority,
            isCurrentlyValid: isPromotionValid(p),
            createdAt: p.createdAt,
        }));

        res.json({
            success: true,
            data: formattedPromotions,
        });
    } catch (error) {
        logger.error('Error getting promotions:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get promotions',
        });
    }
};

/**
 * Get a single promotion by ID
 */
exports.getPromotion = async (req, res) => {
    try {
        const { promotionId } = req.params;

        const promotion = await Promotion.findById(promotionId)
            .populate('applicableProducts', 'name slug price images')
            .lean();

        if (!promotion) {
            return res.status(404).json({
                success: false,
                message: 'Promotion not found',
            });
        }

        res.json({
            success: true,
            data: promotion,
        });
    } catch (error) {
        logger.error('Error getting promotion:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get promotion',
        });
    }
};

/**
 * Create a new promotion
 */
exports.createPromotion = async (req, res) => {
    try {
        const {
            name,
            code,
            description,
            type,
            value,
            scope,
            applicableProducts,
            applicableCategories,
            autoApply,
            showBanner,
            bannerText,
            bannerColor,
            minPurchaseAmount,
            maxDiscountAmount,
            usageLimit,
            validFrom,
            validUntil,
            priority,
        } = req.body;

        // Validate required fields
        if (!name || !description || !type || value === undefined || !validFrom || !validUntil) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields',
            });
        }

        // Check for duplicate code if provided
        if (code) {
            const existingCode = await Promotion.findOne({ code: code.toUpperCase() });
            if (existingCode) {
                return res.status(400).json({
                    success: false,
                    message: 'Promotion code already exists',
                });
            }
        }

        const promotion = await Promotion.create({
            name,
            code: code || undefined,
            description,
            type,
            value,
            scope: scope || 'global',
            applicableProducts: applicableProducts || [],
            applicableCategories: applicableCategories || [],
            autoApply: autoApply || false,
            showBanner: showBanner || false,
            bannerText: bannerText || '',
            bannerColor: bannerColor || '#c41e3a',
            minPurchaseAmount: minPurchaseAmount || 0,
            maxDiscountAmount: maxDiscountAmount || undefined,
            usageLimit: usageLimit || {},
            validFrom: new Date(validFrom),
            validUntil: new Date(validUntil),
            priority: priority || 0,
            isActive: true,
        });

        logger.info(`Promotion created: ${promotion.name}`);

        res.json({
            success: true,
            message: 'Promotion created successfully',
            data: promotion,
        });
    } catch (error) {
        logger.error('Error creating promotion:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create promotion',
        });
    }
};

/**
 * Update a promotion
 */
exports.updatePromotion = async (req, res) => {
    try {
        const { promotionId } = req.params;
        const updates = req.body;

        const promotion = await Promotion.findById(promotionId);
        if (!promotion) {
            return res.status(404).json({
                success: false,
                message: 'Promotion not found',
            });
        }

        // Check for duplicate code if updating code
        if (updates.code && updates.code !== promotion.code) {
            const existingCode = await Promotion.findOne({
                code: updates.code.toUpperCase(),
                _id: { $ne: promotionId },
            });
            if (existingCode) {
                return res.status(400).json({
                    success: false,
                    message: 'Promotion code already exists',
                });
            }
        }

        // Update fields
        const allowedFields = [
            'name',
            'code',
            'description',
            'type',
            'value',
            'scope',
            'applicableProducts',
            'applicableCategories',
            'autoApply',
            'showBanner',
            'bannerText',
            'bannerColor',
            'minPurchaseAmount',
            'maxDiscountAmount',
            'usageLimit',
            'validFrom',
            'validUntil',
            'isActive',
            'priority',
        ];

        allowedFields.forEach((field) => {
            if (updates[field] !== undefined) {
                if (field === 'validFrom' || field === 'validUntil') {
                    promotion[field] = new Date(updates[field]);
                } else {
                    promotion[field] = updates[field];
                }
            }
        });

        await promotion.save();

        logger.info(`Promotion updated: ${promotion.name}`);

        res.json({
            success: true,
            message: 'Promotion updated successfully',
            data: promotion,
        });
    } catch (error) {
        logger.error('Error updating promotion:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update promotion',
        });
    }
};

/**
 * Delete a promotion
 */
exports.deletePromotion = async (req, res) => {
    try {
        const { promotionId } = req.params;

        const promotion = await Promotion.findByIdAndDelete(promotionId);
        if (!promotion) {
            return res.status(404).json({
                success: false,
                message: 'Promotion not found',
            });
        }

        logger.info(`Promotion deleted: ${promotion.name}`);

        res.json({
            success: true,
            message: 'Promotion deleted',
        });
    } catch (error) {
        logger.error('Error deleting promotion:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete promotion',
        });
    }
};

/**
 * Toggle promotion active status
 */
exports.togglePromotionStatus = async (req, res) => {
    try {
        const { promotionId } = req.params;

        const promotion = await Promotion.findById(promotionId);
        if (!promotion) {
            return res.status(404).json({
                success: false,
                message: 'Promotion not found',
            });
        }

        promotion.isActive = !promotion.isActive;
        await promotion.save();

        res.json({
            success: true,
            data: {
                isActive: promotion.isActive,
            },
        });
    } catch (error) {
        logger.error('Error toggling promotion status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update promotion',
        });
    }
};

/**
 * Get products for promotion selection (simplified list)
 */
exports.getProductsForSelection = async (req, res) => {
    try {
        const products = await Product.find({
            isActive: true,
            printfulSyncProductId: { $exists: true, $ne: null },
        })
            .select('name slug price category images')
            .sort({ name: 1 })
            .lean();

        const formattedProducts = products.map((p) => ({
            _id: p._id,
            name: p.name,
            slug: p.slug,
            price: p.price,
            category: p.category,
            image: p.images?.[0]?.url || '/images/placeholder.png',
        }));

        res.json({
            success: true,
            data: formattedProducts,
        });
    } catch (error) {
        logger.error('Error getting products for selection:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get products',
        });
    }
};

// Helper function to check if promotion is currently valid
function isPromotionValid(promotion) {
    const now = new Date();
    return (
        promotion.isActive &&
        now >= new Date(promotion.validFrom) &&
        now <= new Date(promotion.validUntil) &&
        (!promotion.usageLimit?.total || promotion.usageCount < promotion.usageLimit.total)
    );
}
