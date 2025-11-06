const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema(
    {
        key: {
            type: String,
            required: true,
            unique: true,
            enum: [
                'donation_per_purchase',
                'shipping_flat_rate',
                'tax_rate',
                'store_announcement',
                'store_email',
                'store_phone',
                'free_shipping_threshold',
                'maintenance_mode',
            ],
        },
        value: mongoose.Schema.Types.Mixed,
        description: String,
    },
    {
        timestamps: true,
    }
);

settingsSchema.statics.get = async function (key) {
    const setting = await this.findOne({ key });
    return setting ? setting.value : null;
};

settingsSchema.statics.set = async function (key, value) {
    return await this.findOneAndUpdate({ key }, { value }, { upsert: true, new: true });
};

module.exports = mongoose.model('Settings', settingsSchema);
