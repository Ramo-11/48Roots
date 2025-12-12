const Promotion = require('../../models/Promotion');
const { logger } = require('../utils/logger');

/**
 * Get active promotion banners for storefront display
 */
exports.getActiveBanners = async (req, res) => {
    try {
        const banners = await Promotion.findWithBanner();

        const formattedBanners = banners.map((b) => ({
            _id: b._id,
            text: b.bannerText || b.description,
            color: b.bannerColor,
            code: b.code,
            type: b.type,
            value: b.value,
            validUntil: b.validUntil,
        }));

        res.json({
            success: true,
            data: formattedBanners,
        });
    } catch (error) {
        logger.error('Error getting promotion banners:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get promotions',
        });
    }
};

/**
 * Get auto-apply promotions (for calculating discounts on products)
 */
exports.getAutoApplyPromotions = async (req, res) => {
    try {
        const promotions = await Promotion.findAutoApply();

        const formattedPromotions = promotions.map((p) => ({
            _id: p._id,
            name: p.name,
            type: p.type,
            value: p.value,
            scope: p.scope,
            applicableProducts: p.applicableProducts,
            applicableCategories: p.applicableCategories,
            minPurchaseAmount: p.minPurchaseAmount,
            maxDiscountAmount: p.maxDiscountAmount,
        }));

        res.json({
            success: true,
            data: formattedPromotions,
        });
    } catch (error) {
        logger.error('Error getting auto-apply promotions:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get promotions',
        });
    }
};

/**
 * Validate and apply a promotion code
 */
exports.validateCode = async (req, res) => {
    try {
        const { code, subtotal, cartItems } = req.body;

        if (!code) {
            return res.status(400).json({
                success: false,
                message: 'Promotion code is required',
            });
        }

        const promotion = await Promotion.findByCode(code);

        if (!promotion) {
            return res.status(404).json({
                success: false,
                message: 'Invalid promotion code',
            });
        }

        if (!promotion.isValid()) {
            return res.status(400).json({
                success: false,
                message: 'This promotion has expired or is no longer valid',
            });
        }

        if (subtotal && promotion.minPurchaseAmount > subtotal) {
            return res.status(400).json({
                success: false,
                message: `Minimum purchase of $${promotion.minPurchaseAmount.toFixed(2)} required`,
            });
        }

        // Calculate discount
        const discount = promotion.calculateDiscount(subtotal || 0);

        res.json({
            success: true,
            data: {
                promotion: {
                    _id: promotion._id,
                    name: promotion.name,
                    code: promotion.code,
                    type: promotion.type,
                    value: promotion.value,
                    description: promotion.description,
                },
                discount,
                message: `Promotion applied: ${promotion.name}`,
            },
        });
    } catch (error) {
        logger.error('Error validating promotion code:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to validate promotion',
        });
    }
};

/**
 * Get promotions applicable to a specific product
 */
exports.getProductPromotions = async (req, res) => {
    try {
        const { productId } = req.params;
        const { category, price } = req.query;

        const promotions = await Promotion.findForProduct(productId, category);

        if (price) {
            const priceNum = parseFloat(price);
            const formattedPromotions = promotions.map((p) => ({
                _id: p._id,
                name: p.name,
                type: p.type,
                value: p.value,
                discountedPrice: p.getDiscountedPrice(priceNum),
                savings: priceNum - p.getDiscountedPrice(priceNum),
            }));

            // Find best promotion
            const best =
                formattedPromotions.length > 0
                    ? formattedPromotions.reduce((a, b) => (a.savings > b.savings ? a : b))
                    : null;

            res.json({
                success: true,
                data: {
                    promotions: formattedPromotions,
                    best,
                },
            });
        } else {
            res.json({
                success: true,
                data: {
                    promotions: promotions.map((p) => ({
                        _id: p._id,
                        name: p.name,
                        type: p.type,
                        value: p.value,
                    })),
                },
            });
        }
    } catch (error) {
        logger.error('Error getting product promotions:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get promotions',
        });
    }
};

/**
 * Calculate cart discount with auto-apply promotions
 */
exports.calculateCartDiscount = async (req, res) => {
    try {
        const { cartItems, subtotal } = req.body;

        const autoPromotions = await Promotion.findAutoApply();

        let totalDiscount = 0;
        const appliedPromotions = [];

        for (const promo of autoPromotions) {
            if (promo.scope === 'global') {
                const discount = promo.calculateDiscount(subtotal);
                if (discount > 0) {
                    totalDiscount += discount;
                    appliedPromotions.push({
                        _id: promo._id,
                        name: promo.name,
                        type: promo.type,
                        value: promo.value,
                        discount,
                    });
                }
            } else {
                // Calculate discount for applicable items only
                let applicableSubtotal = 0;

                for (const item of cartItems || []) {
                    if (promo.appliesToProduct(item.product)) {
                        applicableSubtotal += item.price * item.quantity;
                    }
                }

                if (applicableSubtotal > 0) {
                    const discount = promo.calculateDiscount(subtotal, applicableSubtotal);
                    if (discount > 0) {
                        totalDiscount += discount;
                        appliedPromotions.push({
                            _id: promo._id,
                            name: promo.name,
                            type: promo.type,
                            value: promo.value,
                            discount,
                        });
                    }
                }
            }
        }

        res.json({
            success: true,
            data: {
                totalDiscount,
                appliedPromotions,
                finalSubtotal: subtotal - totalDiscount,
            },
        });
    } catch (error) {
        logger.error('Error calculating cart discount:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to calculate discount',
        });
    }
};
