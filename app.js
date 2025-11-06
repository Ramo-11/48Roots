const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const session = require('express-session');
const MongoStore = require('connect-mongo');
require('dotenv').config();

const router = require('./server/router');
const { logger } = require('./server/utils/logger');
const connectDB = require('./server/controllers/dbController');

const app = express();
const PORT = process.env.PORT || 3000;

logger.info(`Running in ${process.env.NODE_ENV || 'development'} mode`);

connectDB();

app.set('view engine', 'ejs');
app.set('views', './views');
app.use(expressLayouts);
app.set('layout', 'layout');
app.set('layout extractScripts', true);
app.set('layout extractStyles', true);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));
app.use(cookieParser());

const isProd = process.env.NODE_ENV === 'production';
const baseUri = isProd ? process.env.MONGODB_URI_PROD : process.env.MONGODB_URI_DEV;
const dbName = isProd ? process.env.DB_NAME_PROD : process.env.DB_NAME_DEV;
const mongoUri = `${baseUri}${baseUri.includes('?') ? '&' : '?'}dbName=${dbName}`;

app.use(
    session({
        secret: process.env.SESSION_SECRET || 'your-secret-key-change-this',
        resave: false,
        saveUninitialized: true,
        store: MongoStore.create({
            mongoUrl: mongoUri,
            touchAfter: 24 * 3600,
        }),
        cookie: {
            maxAge: 30 * 24 * 60 * 60 * 1000,
            httpOnly: true,
            secure: isProd,
        },
    })
);

app.use((req, res, next) => {
    const blockedIPs = process.env.BLOCKED_IPS ? process.env.BLOCKED_IPS.split(',') : [];
    const clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    if (blockedIPs.includes(clientIP)) {
        logger.warn(`Blocked IP attempt: ${clientIP}`);
        return res.status(403).send('Forbidden');
    }
    next();
});

app.use((req, res, next) => {
    const userAgent = req.headers['user-agent'] || '';
    const blockedAgents = ['', 'zgrab/0.x'];

    if (blockedAgents.includes(userAgent.trim())) {
        logger.warn(`Blocked user agent: ${userAgent}`);
        return res.status(403).send('Forbidden');
    }
    next();
});

app.use('/', router);

app.use((req, res) => {
    res.status(404).render('404', {
        title: '404 - Page Not Found',
        description: 'The page you are looking for does not exist',
        additionalCSS: ['404.css'],
        layout: 'layout',
    });
});

app.use((err, req, res, next) => {
    logger.error(`Server error: ${err.message}`, { stack: err.stack });
    res.status(500).render('500', {
        title: '500 - Server Error',
        description: 'Something went wrong on our end',
        additionalCSS: ['500.css'],
        layout: 'layout',
    });
});

app.listen(PORT, () => {
    logger.info(`Server running on http://localhost:${PORT}`);
});
