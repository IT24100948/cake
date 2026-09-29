const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const { clientUrl, uploadDir, isTest, isVercel } = require('./config/env');
const { requireStaff } = require('./middleware/auth');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const authRoutes = require('./routes/auth.routes');
const customerSelfRoutes = require('./routes/customerSelf.routes');
const adminRoutes = require('./routes/admin.routes');
const { publicRouter: catalogPublic, staffRouter: catalogStaff } = require('./routes/catalog.routes');
const operationsRoutes = require('./routes/operations.routes');

const app = express();

// Behind Vercel's edge the client IP arrives in X-Forwarded-For (used by the audit log).
app.set('trust proxy', isVercel ? true : 'loopback');
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
// Same-origin on Vercel; CLIENT_URL may list extra origins (comma-separated) for separate front-ends.
app.use(cors({ origin: clientUrl.split(',').map((s) => s.trim()), credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
if (!isTest) app.use(morgan('dev'));

if (!isVercel) app.use('/uploads', express.static(uploadDir, { maxAge: '7d' }));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

const api = express.Router();
api.use('/auth', authRoutes);
api.use(catalogPublic);
api.use(customerSelfRoutes); // each route requires a customer login

// Everything below requires an authenticated, active staff member (checked once per request).
const staffApi = express.Router();
staffApi.use(requireStaff());
staffApi.use(adminRoutes);
staffApi.use(catalogStaff);
staffApi.use(operationsRoutes);
api.use(staffApi);
app.use('/api', api);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
