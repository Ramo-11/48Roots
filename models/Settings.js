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
                // Printful settings
                'printful_auto_sync',
                'printful_last_sync',
                'printful_webhook_secret',
            ],
        },
        value: mongoose.Schema.Types.Mixed,
        description: String,
    },
    {
        timestamps: true,
    }
);

/**
 * Get a setting value by key
 * @param {string} key - Setting key
 * @returns {Promise<any>} Setting value or null
 */
settingsSchema.statics.get = async function (key) {
    const setting = await this.findOne({ key });
    return setting ? setting.value : null;
};

/**
 * Set a setting value
 * @param {string} key - Setting key
 * @param {any} value - Value to set
 * @returns {Promise<Object>} Updated setting document
 */
settingsSchema.statics.set = async function (key, value) {
    return await this.findOneAndUpdate({ key }, { value }, { upsert: true, new: true });
};

/**
 * Get multiple settings at once
 * @param {string[]} keys - Array of setting keys
 * @returns {Promise<Object>} Object with key-value pairs
 */
settingsSchema.statics.getMultiple = async function (keys) {
    const settings = await this.find({ key: { $in: keys } });
    const result = {};

    for (const setting of settings) {
        result[setting.key] = setting.value;
    }

    return result;
};

/**
 * Initialize default settings if they don't exist
 */
settingsSchema.statics.initializeDefaults = async function () {
    const defaults = [
        { key: 'donation_per_purchase', value: 5.0, description: 'Donation amount per purchase' },
        { key: 'shipping_flat_rate', value: 5.99, description: 'Flat rate shipping cost' },
        {
            key: 'free_shipping_threshold',
            value: 75.0,
            description: 'Order amount for free shipping',
        },
        { key: 'tax_rate', value: 0, description: 'Tax rate percentage' },
        { key: 'store_email', value: 'support@48roots.com', description: 'Store contact email' },
        {
            key: 'printful_auto_sync',
            value: false,
            description: 'Auto-sync products from Printful',
        },
    ];

    for (const setting of defaults) {
        await this.findOneAndUpdate(
            { key: setting.key },
            { $setOnInsert: setting },
            { upsert: true }
        );
    }
};

module.exports = mongoose.model('Settings', settingsSchema);
