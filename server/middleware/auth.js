/**
 * Authentication Middleware
 * Handles user authentication and authorization for admin routes
 */

/**
 * Attach user to res.locals for templates
 */
exports.attachUserToLocals = (req, res, next) => {
    res.locals.user = req.session?.user || null;
    res.locals.isAdmin = req.session?.user?.isAdmin || false;
    next();
};

/**
 * Check if user is authenticated
 */
exports.isAuthenticated = (req, res, next) => {
    if (req.session?.user) {
        return next();
    }

    if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(401).json({
            success: false,
            message: 'Authentication required',
        });
    }

    res.redirect('/admin/login');
};

/**
 * Check if user is admin
 * For simplicity, uses environment variable for admin credentials
 * In production, you may want to use a database-backed user system
 */
exports.isAdmin = (req, res, next) => {
    // Check session first
    if (req.session?.user?.isAdmin) {
        return next();
    }

    // Check for basic auth header (useful for API access)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Basic ')) {
        const base64Credentials = authHeader.split(' ')[1];
        const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
        const [username, password] = credentials.split(':');

        if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
            req.session.user = { username, isAdmin: true };
            return next();
        }
    }

    // Check query params for simple token auth (for testing)
    if (
        process.env.NODE_ENV === 'development' &&
        req.query.admin_token === process.env.ADMIN_TOKEN
    ) {
        req.session.user = { username: 'admin', isAdmin: true };
        return next();
    }

    if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(403).json({
            success: false,
            message: 'Admin access required',
        });
    }

    res.redirect('/admin/login');
};

/**
 * Admin login handler
 */
exports.adminLogin = (req, res) => {
    const { username, password } = req.body;

    if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
        req.session.user = { username, isAdmin: true };
        return res.json({ success: true, redirect: '/admin' });
    }

    res.status(401).json({
        success: false,
        message: 'Invalid credentials',
    });
};

/**
 * Admin logout handler
 */
exports.adminLogout = (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Session destroy error:', err);
        }
        res.redirect('/admin/login');
    });
};
