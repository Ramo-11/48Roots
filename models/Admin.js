const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const adminSchema = new mongoose.Schema(
    {
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },
        password: {
            type: String,
            required: true,
        },
        name: {
            type: String,
            required: true,
        },
        role: {
            type: String,
            enum: ['super_admin', 'admin', 'manager'],
            default: 'admin',
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        lastLogin: Date,
        loginAttempts: {
            type: Number,
            default: 0,
        },
        lockUntil: Date,
    },
    {
        timestamps: true,
    }
);

adminSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 12);
    next();
});

adminSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

adminSchema.methods.isLocked = function () {
    return !!(this.lockUntil && this.lockUntil > Date.now());
};

adminSchema.methods.incrementLoginAttempts = async function () {
    if (this.lockUntil && this.lockUntil < Date.now()) {
        return await this.updateOne({
            $set: { loginAttempts: 1 },
            $unset: { lockUntil: 1 },
        });
    }

    const updates = { $inc: { loginAttempts: 1 } };

    if (this.loginAttempts + 1 >= 5 && !this.isLocked()) {
        updates.$set = { lockUntil: Date.now() + 2 * 60 * 60 * 1000 };
    }

    return await this.updateOne(updates);
};

adminSchema.methods.resetLoginAttempts = async function () {
    return await this.updateOne({
        $set: { loginAttempts: 0, lastLogin: new Date() },
        $unset: { lockUntil: 1 },
    });
};

module.exports = mongoose.model('Admin', adminSchema);
