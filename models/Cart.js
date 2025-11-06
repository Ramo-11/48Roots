const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true,
    },
    variant: {
        size: String,
        color: String,
    },
    quantity: {
        type: Number,
        required: true,
        min: 1,
        default: 1,
    },
    price: {
        type: Number,
        required: true,
    },
});

const cartSchema = new mongoose.Schema(
    {
        sessionId: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        items: [cartItemSchema],
        subtotal: {
            type: Number,
            default: 0,
        },
        expiresAt: {
            type: Date,
            default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            index: { expires: 0 },
        },
    },
    {
        timestamps: true,
    }
);

cartSchema.methods.calculateSubtotal = function () {
    this.subtotal = this.items.reduce((total, item) => {
        return total + item.price * item.quantity;
    }, 0);
    return this.subtotal;
};

module.exports = mongoose.model('Cart', cartSchema);
