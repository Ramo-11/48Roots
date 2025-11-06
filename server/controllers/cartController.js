const Cart = require('../../models/Cart');
const Product = require('../../models/Product');
const { logger } = require('../utils/logger');

const getOrCreateCart = async (sessionId) => {
    let cart = await Cart.findOne({ sessionId }).populate('items.product');

    if (!cart) {
        cart = await Cart.create({ sessionId, items: [] });
    }

    return cart;
};

exports.addToCart = async (req, res) => {
    try {
        const { productId, variant, quantity } = req.body;
        const sessionId = req.session.id;

        if (!sessionId) {
            return res.status(400).json({
                success: false,
                message: 'Session ID required',
            });
        }

        const product = await Product.findById(productId);
        if (!product || !product.isActive) {
            return res.status(404).json({
                success: false,
                message: 'Product not found',
            });
        }

        const productVariant = product.variants.find((v) => v.size === variant.size);
        if (!productVariant || productVariant.stock < quantity) {
            return res.status(400).json({
                success: false,
                message: 'Insufficient stock',
            });
        }

        const cart = await getOrCreateCart(sessionId);

        const existingItemIndex = cart.items.findIndex(
            (item) =>
                item.product._id.toString() === productId && item.variant.size === variant.size
        );

        if (existingItemIndex > -1) {
            cart.items[existingItemIndex].quantity += quantity;
        } else {
            cart.items.push({
                product: productId,
                variant,
                quantity,
                price: product.price,
            });
        }

        cart.calculateSubtotal();
        await cart.save();
        await cart.populate('items.product');

        res.json({
            success: true,
            data: cart,
        });
    } catch (error) {
        logger.error('Error adding to cart:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to add to cart',
        });
    }
};

exports.updateCartItem = async (req, res) => {
    try {
        const { productId, variant, quantity } = req.body;
        const sessionId = req.session.id;

        if (!sessionId) {
            return res.status(400).json({
                success: false,
                message: 'Session ID required',
            });
        }

        const cart = await Cart.findOne({ sessionId }).populate('items.product');
        if (!cart) {
            return res.status(404).json({
                success: false,
                message: 'Cart not found',
            });
        }

        const itemIndex = cart.items.findIndex(
            (item) =>
                item.product._id.toString() === productId && item.variant.size === variant.size
        );

        if (itemIndex === -1) {
            return res.status(404).json({
                success: false,
                message: 'Item not found in cart',
            });
        }

        if (quantity <= 0) {
            cart.items.splice(itemIndex, 1);
        } else {
            const product = await Product.findById(productId);
            const productVariant = product.variants.find((v) => v.size === variant.size);

            if (productVariant.stock < quantity) {
                return res.status(400).json({
                    success: false,
                    message: 'Insufficient stock',
                });
            }

            cart.items[itemIndex].quantity = quantity;
        }

        cart.calculateSubtotal();
        await cart.save();
        await cart.populate('items.product');

        res.json({
            success: true,
            data: cart,
        });
    } catch (error) {
        logger.error('Error updating cart:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update cart',
        });
    }
};

exports.removeFromCart = async (req, res) => {
    try {
        const { productId, variant } = req.body;
        const sessionId = req.session.id;

        if (!sessionId) {
            return res.status(400).json({
                success: false,
                message: 'Session ID required',
            });
        }

        const cart = await Cart.findOne({ sessionId }).populate('items.product');
        if (!cart) {
            return res.status(404).json({
                success: false,
                message: 'Cart not found',
            });
        }

        cart.items = cart.items.filter(
            (item) =>
                !(item.product._id.toString() === productId && item.variant.size === variant.size)
        );

        cart.calculateSubtotal();
        await cart.save();
        await cart.populate('items.product');

        res.json({
            success: true,
            data: cart,
        });
    } catch (error) {
        logger.error('Error removing from cart:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to remove from cart',
        });
    }
};

exports.getCartData = async (req, res) => {
    try {
        const sessionId = req.session.id;

        if (!sessionId) {
            return res.json({
                success: true,
                data: { items: [], subtotal: 0 },
            });
        }

        const cart = await getOrCreateCart(sessionId);

        res.json({
            success: true,
            data: cart,
        });
    } catch (error) {
        logger.error('Error fetching cart:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch cart',
        });
    }
};
