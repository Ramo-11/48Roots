const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
        },
        message: {
            type: String,
            required: true,
        },
        type: {
            type: String,
            enum: ['info', 'success', 'warning', 'promo'],
            default: 'info',
        },
        link: {
            url: String,
            text: String,
        },
        displayLocation: {
            type: String,
            enum: ['banner', 'popup', 'both'],
            default: 'banner',
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        startDate: Date,
        endDate: Date,
        priority: {
            type: Number,
            default: 0,
        },
    },
    {
        timestamps: true,
    }
);

announcementSchema.index({ isActive: 1, priority: -1 });

announcementSchema.methods.isCurrentlyActive = function () {
    if (!this.isActive) return false;

    const now = new Date();
    if (this.startDate && now < this.startDate) return false;
    if (this.endDate && now > this.endDate) return false;

    return true;
};

module.exports = mongoose.model('Announcement', announcementSchema);
