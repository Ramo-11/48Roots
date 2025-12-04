const Admin = require('../../models/Admin');

exports.validateSession = async (req, res, next) => {
    if (!req.session?.adminId) {
        res.locals.currentAdmin = null;
        return next();
    }

    const admin = await Admin.findById(req.session.adminId);

    if (!admin || !admin.isActive) {
        req.session.destroy(() => {});
        res.locals.currentAdmin = null;
        return res.redirect('/admin/login');
    }

    req.currentAdmin = admin;
    res.locals.currentAdmin = {
        id: admin._id,
        name: admin.name,
        role: admin.role,
    };

    next();
};
