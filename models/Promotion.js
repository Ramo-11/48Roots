const mongoose = require('mongoose');

const promotionSchema = new mongoose.Schema(
    {
        code: {
            type: String,
            required: true,
            unique: true,
            uppercase: true,
            trim: true,
            index: true,
        },
        description: {
            type: String,
            required: true,
        },
        type: {
            type: String,
            enum: ['percentage', 'fixed', 'free_shipping'],
            required: true,
        },
        value: {
            type: Number,
            required: true,
            min: 0,
        },
        minPurchaseAmount: {
            type: Number,
            default: 0,
        },
        maxDiscountAmount: Number,
        usageLimit: {
            total: Number,
            perCustomer: {
                type: Number,
                default: 1,
            },
        },
        usageCount: {
            type: Number,
            default: 0,
        },
        validFrom: {
            type: Date,
            required: true,
        },
        validUntil: {
            type: Date,
            required: true,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        applicableProducts: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Product',
            },
        ],
        applicableCategories: [String],
    },
    {
        timestamps: true,
    }
);

promotionSchema.index({ code: 1, isActive: 1 });
promotionSchema.index({ validFrom: 1, validUntil: 1 });

promotionSchema.methods.isValid = function () {
    const now = new Date();
    return (
        this.isActive &&
        now >= this.validFrom &&
        now <= this.validUntil &&
        (!this.usageLimit?.total || this.usageCount < this.usageLimit.total)
    );
};

promotionSchema.methods.calculateDiscount = function (subtotal) {
    if (!this.isValid() || subtotal < this.minPurchaseAmount) {
        return 0;
    }

    let discount = 0;
    if (this.type === 'percentage') {
        discount = (subtotal * this.value) / 100;
    } else if (this.type === 'fixed') {
        discount = this.value;
    }

    if (this.maxDiscountAmount) {
        discount = Math.min(discount, this.maxDiscountAmount);
    }

    return Math.min(discount, subtotal);
};

module.exports = mongoose.model('Promotion', promotionSchema);
