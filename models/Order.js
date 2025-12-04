const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true,
    },
    productSnapshot: {
        name: String,
        slug: String,
        image: String,
    },
    variant: {
        size: String,
        color: String,
        sku: String,
        // Printful variant tracking
        printfulVariantId: Number,
        printfulSyncVariantId: Number,
    },
    quantity: {
        type: Number,
        required: true,
        min: 1,
    },
    price: {
        type: Number,
        required: true,
    },
    subtotal: {
        type: Number,
        required: true,
    },
});

const orderSchema = new mongoose.Schema(
    {
        orderNumber: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        customer: {
            email: {
                type: String,
                required: true,
            },
            firstName: {
                type: String,
                required: true,
            },
            lastName: {
                type: String,
                required: true,
            },
            phone: String,
        },
        shippingAddress: {
            line1: {
                type: String,
                required: true,
            },
            line2: String,
            city: {
                type: String,
                required: true,
            },
            state: {
                type: String,
                required: true,
            },
            postalCode: {
                type: String,
                required: true,
            },
            country: {
                type: String,
                required: true,
                default: 'US',
            },
        },
        billingAddress: {
            line1: String,
            line2: String,
            city: String,
            state: String,
            postalCode: String,
            country: String,
        },
        items: [orderItemSchema],
        subtotal: {
            type: Number,
            required: true,
        },
        shipping: {
            cost: {
                type: Number,
                default: 0,
            },
            method: String,
        },
        tax: {
            type: Number,
            default: 0,
        },
        discount: {
            code: String,
            amount: {
                type: Number,
                default: 0,
            },
        },
        donation: {
            amount: {
                type: Number,
                required: true,
            },
            description: String,
        },
        total: {
            type: Number,
            required: true,
        },
        payment: {
            method: {
                type: String,
                enum: ['stripe', 'paypal'],
                default: 'stripe',
            },
            stripePaymentIntentId: String,
            status: {
                type: String,
                enum: ['pending', 'completed', 'failed', 'refunded'],
                default: 'pending',
            },
            paidAt: Date,
        },
        fulfillment: {
            status: {
                type: String,
                enum: [
                    'pending',
                    'processing',
                    'shipped',
                    'delivered',
                    'cancelled',
                    'on_hold',
                    'failed',
                ],
                default: 'pending',
            },
            trackingNumber: String,
            trackingUrl: String,
            carrier: String,
            shippedAt: Date,
            deliveredAt: Date,
            // Printful order tracking (replacing Printify)
            printfulOrderId: {
                type: Number,
                index: true,
                sparse: true,
            },
            printfulOrderStatus: {
                type: String,
                enum: [
                    'draft',
                    'pending',
                    'failed',
                    'canceled',
                    'inprocess',
                    'onhold',
                    'partial',
                    'fulfilled',
                    'archived',
                ],
            },
            // Legacy Printify field (kept for migration)
            printifyOrderId: String,
        },
        notes: String,
        metadata: {
            ipAddress: String,
            userAgent: String,
        },
    },
    {
        timestamps: true,
    }
);

// Indexes
orderSchema.index({ 'customer.email': 1 });
orderSchema.index({ 'payment.status': 1 });
orderSchema.index({ 'fulfillment.status': 1 });
orderSchema.index({ 'fulfillment.printfulOrderId': 1 });
orderSchema.index({ createdAt: -1 });

// Generate order number before save
orderSchema.pre('save', function (next) {
    if (!this.orderNumber) {
        this.orderNumber =
            '48R-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5).toUpperCase();
    }
    next();
});

// Virtual to check if order is Printful order
orderSchema.virtual('isPrintfulOrder').get(function () {
    return !!this.fulfillment.printfulOrderId;
});

// Method to update from Printful webhook
orderSchema.methods.updateFromPrintful = async function (printfulData) {
    if (printfulData.status) {
        this.fulfillment.printfulOrderStatus = printfulData.status;

        // Map Printful status to our fulfillment status
        const statusMap = {
            draft: 'pending',
            pending: 'pending',
            failed: 'failed',
            canceled: 'cancelled',
            inprocess: 'processing',
            onhold: 'on_hold',
            partial: 'shipped',
            fulfilled: 'delivered',
            archived: 'delivered',
        };

        this.fulfillment.status = statusMap[printfulData.status] || this.fulfillment.status;
    }

    // Update shipment info if available
    if (printfulData.shipments && printfulData.shipments.length > 0) {
        const shipment = printfulData.shipments[0];
        this.fulfillment.trackingNumber = shipment.tracking_number;
        this.fulfillment.carrier = shipment.carrier;
        this.fulfillment.trackingUrl = shipment.tracking_url;

        if (shipment.shipped_at) {
            this.fulfillment.shippedAt = new Date(shipment.shipped_at * 1000);
        }
    }

    await this.save();
    return this;
};

module.exports = mongoose.model('Order', orderSchema);
