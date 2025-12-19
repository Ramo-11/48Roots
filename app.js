// ********** Imports **************
const expressLayouts = require('express-ejs-layouts');
const express = require('express');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');

const router = require('./server/router');
const { logger } = require('./server/utils/logger');
const connectDB = require('./server/controllers/dbController');
const { sessionMiddleware } = require('./server/middleware/sessionController');
const { validateSession } = require('./server/middleware/sessionValidator');
// ********** End Imports **********

// ********** Initialization **************
const app = express();
require('dotenv').config({ quiet: true });
logger.info('Running in ' + process.env.NODE_ENV + ' mode');
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
app.set('trust proxy', 1);
app.use(sessionMiddleware);
app.use(validateSession);
// ********** End Initialization **********

app.use('/', router);

// 404
app.use((req, res) => {
    res.status(404).render('404', {
        title: 'Page Not Found',
        layout: 'layout',
        description: 'Not Found',
        isAdmin: false,
        additionalCSS: ['404.css'],
    });
});

// 500
app.use((err, req, res, next) => {
    logger.error(`Server error: ${err.message}`, { stack: err.stack });
    res.status(500).render('500', {
        title: 'Server Error',
        layout: 'layout',
        description: 'Error',
        isAdmin: false,
        additionalCSS: ['500.css'],
    });
});

app.listen(process.env.PORT, () =>
    logger.info(`Server running on port: http://localhost:${process.env.PORT}`)
);
