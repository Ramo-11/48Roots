const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
require('dotenv').config();

const connectDB = require('./server/controllers/dbController');
const { logger } = require('./server/utils/logger');

const { sessionMiddleware } = require('./server/middleware/sessionController');
const { validateSession, enforceRole } = require('./server/middleware/sessionValidator');
const authController = require('./server/controllers/authController');

const router = require('./server/router');

const app = express();
const PORT = process.env.PORT || 3000;

// Connect DB
logger.info(`Running in ${process.env.NODE_ENV} mode`);
connectDB();

// View engine settings
app.set('view engine', 'ejs');
app.set('views', './views');
app.use(expressLayouts);
app.set('layout', 'layout');
app.set('layout extractScripts', true);
app.set('layout extractStyles', true);

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));
app.use(cookieParser());

app.set('trust proxy', 1);

// Session Middleware
app.use(sessionMiddleware);

// Session Validation (like other project)
app.use(validateSession);

// Load current admin into locals
app.use(authController.attachUserToLocals);

app.use((req, res, next) => {
    res.locals.isAdmin = !!req.currentAdmin; // true if logged in as admin
    next();
});

// IP blocking
app.use((req, res, next) => {
    const blocked = process.env.BLOCKED_IPS ? process.env.BLOCKED_IPS.split(',') : [];
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    if (blocked.includes(ip)) {
        logger.warn(`Blocked IP: ${ip}`);
        return res.status(403).send('Forbidden');
    }
    next();
});

// UA blocking
app.use((req, res, next) => {
    const ua = req.headers['user-agent'] || '';
    const blockedAgents = ['', 'zgrab/0.x'];

    if (blockedAgents.includes(ua.trim())) {
        logger.warn(`Blocked agent: ${ua}`);
        return res.status(403).send('Forbidden');
    }
    next();
});

// Router
app.use('/', router);

// 404
app.use((req, res) => {
    res.status(404).render('404', {
        title: 'Page Not Found',
        layout: 'layout',
        additionalCSS: ['404.css'],
    });
});

// 500
app.use((err, req, res, next) => {
    logger.error(`Server error: ${err.message}`, { stack: err.stack });
    res.status(500).render('500', {
        title: 'Server Error',
        layout: 'layout',
        additionalCSS: ['500.css'],
    });
});

app.listen(PORT, () => {
    logger.info(`Server running: http://localhost:${PORT}`);
});
