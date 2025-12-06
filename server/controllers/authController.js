// controllers/adminAuthController.js
const Admin = require('../../models/Admin');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

exports.attachAdminToLocals = (req, res, next) => {
    res.locals.currentAdmin = req.session?.adminId
        ? { id: req.session.adminId, name: req.session.adminName }
        : null;
    next();
};

// GET login
exports.getLogin = (req, res) => {
    if (req.session?.adminId) return res.redirect('/admin/dashboard');
    res.render('admin/login', {
        title: 'Admin Login',
        additionalCSS: ['admin/login.css'],
        additionalJS: ['admin/login.js'],
        layout: 'layout',
        description: 'Admin Login',
        isAdmin: false,
        error: req.flash?.('error'),
        success: req.flash?.('success'),
    });
};

// POST login
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password)
            return res.status(400).json({ success: false, message: 'Email & password required' });

        const admin = await Admin.findOne({ email: email.toLowerCase() });
        if (!admin)
            return res
                .status(401)
                .json({ success: false, message: 'User not found in the system' });

        const valid = await bcrypt.compare(password, admin.password);
        if (!valid) return res.status(401).json({ success: false, message: 'Invalid credentials' });

        req.session.adminId = admin._id;
        req.session.adminName = admin.fullName;

        const token = jwt.sign({ adminId: admin._id }, process.env.JWT_SECRET || 'secret', {
            expiresIn: '30d',
        });

        req.session.token = token;

        res.json({
            success: true,
            message: 'Login successful',
            admin: { id: admin._id, name: admin.fullName, email: admin.email },
        });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Login error' });
    }
};

// Logout
exports.logout = (req, res) => {
    req.session.destroy(() => {
        res.clearCookie('connect.sid');
        res.redirect('/admin/login');
    });
};

// Middleware: only admin
exports.isAuthenticated = async (req, res, next) => {
    if (!req.session?.adminId) {
        if (req.path.startsWith('/api/'))
            return res.status(401).json({ success: false, message: 'Auth required' });
        return res.redirect('/admin/login');
    }

    const admin = await Admin.findById(req.session.adminId);
    if (!admin) {
        req.session.destroy();
        return res.redirect('/admin/login');
    }

    req.admin = admin;
    next();
};
