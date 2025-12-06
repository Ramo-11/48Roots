const mongoose = require('mongoose');
const Admin = require('../models/Admin');
require('dotenv').config();

const isProd = process.env.NODE_ENV === 'production';
const baseUri = isProd ? process.env.MONGODB_URI_PROD : process.env.MONGODB_URI_DEV;
const dbName = isProd ? process.env.DB_NAME_PROD : process.env.DB_NAME_DEV;

// check that baseUri is not empty
if (!baseUri) {
    logger.error('MongoDB URI is not defined - will not connect');
    return;
}
process.env.MONGODB_URI = `${baseUri}${baseUri.includes('?') ? '&' : '?'}dbName=${dbName}`;

mongoose.connect(process.env.MONGODB_URI);

async function createAdmin() {
    await Admin.create({
        email: 'admin@48roots.com',
        password: 'Admin123!', // hashed automatically via pre-save hook
        name: '48Roots Admin',
        role: 'super_admin', // admin | manager also allowed
        isActive: true,
    });

    process.exit();
}

createAdmin();
