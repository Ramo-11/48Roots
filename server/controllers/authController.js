const Admin = require('../../models/Admin');
const { logger } = require('../utils/logger');

/**
 * Attach admin to res.locals for templates
 */
exports.attachUserToLocals = (req, res, next) => {
    if (req.session && req.session.adminId) {
        res.locals.currentAdmin = {
            id: req.session.adminId,
            name: req.session.adminName,
            role: req.session.adminRole,
        };
    } else {
        res.locals.currentAdmin = null;
    }
    next();
};

/**
 * GET Login Page
 */
exports.getLogin = (req, res) => {
    if (req.session && req.session.adminId) {
        return res.redirect('/admin');
    }

    res.render('admin/login', {
        title: 'Admin Login - 48Roots',
        description: 'Admin Login',
        layout: 'layout',
        isAdmin: false,
        additionalCSS: ['admin/login.css', 'admin/common.css'],
        additionalJS: ['admin/login.js'],
        error: null,
    });
};

/**
 * POST Login
 */
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Missing email or password' });
        }

        const admin = await Admin.findOne({ email: email.toLowerCase() });

        if (!admin) {
            return res.status(401).json({ success: false, message: 'Invalid email' });
        }

        // Check active
        if (!admin.isActive) {
            return res.status(403).json({
                success: false,
                message: 'Account deactivated. Contact system owner.',
            });
        }

        // Check locked
        if (admin.isLocked()) {
            return res.status(403).json({
                success: false,
                message: 'Too many failed attempts. Try again later.',
            });
        }

        const valid = await admin.comparePassword(password);

        if (!valid) {
            await admin.incrementLoginAttempts();
            return res.status(401).json({ success: false, message: 'Wrong password' });
        }

        await admin.resetLoginAttempts();

        // Create session
        req.session.adminId = admin._id;
        req.session.adminName = admin.name;
        req.session.adminRole = admin.role;

        return res.json({ success: true, redirect: '/admin' });
    } catch (error) {
        logger.error('Admin login error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

/**
 * Logout
 */
exports.logout = (req, res) => {
    req.session.destroy(() => {
        res.redirect('/admin/login');
    });
};

/**
 * Middleware: Must be logged in
 */
exports.isAuthenticated = (req, res, next) => {
    if (!req.session || !req.session.adminId) {
        return res.redirect('/admin/login');
    }
    next();
};

/**
 * Middleware: Must have specific admin roles
 * Example: isAdmin('super_admin', 'admin')
 */
exports.isAdmin = (...roles) => {
    return (req, res, next) => {
        if (!req.session || !req.session.adminId) {
            return res.redirect('/admin/login');
        }

        if (!roles.length || roles.includes(req.session.adminRole)) {
            return next();
        }

        return res.status(403).render('admin/403', {
            title: 'Forbidden',
            layout: 'layout',
            message: 'You do not have permission to access this area.',
        });
    };
};
