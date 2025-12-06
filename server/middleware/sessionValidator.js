// middleware/validateAdminSession.js
const Admin = require('../../models/Admin');
const { logger } = require('../utils/logger');

exports.validateSession = async (req, res, next) => {
    if (!req.session || !req.session.adminId) return next();

    try {
        const admin = await Admin.findById(req.session.adminId).select('email fullName');

        if (!admin) {
            logger.warn(`Invalid admin session: ${req.session.adminId}`);
            req.session.destroy();
            return res.redirect('/admin/login');
        }

        // Update session name if changed
        if (admin.fullName !== req.session.adminName) {
            req.session.adminName = admin.fullName;
        }

        // Attach admin to request + views
        req.currentAdmin = admin;
        res.locals.admin = admin;

        next();
    } catch (err) {
        logger.error(`Admin session validation error: ${err}`);
        req.session.destroy();
        return res.redirect('/admin/login');
    }
};
