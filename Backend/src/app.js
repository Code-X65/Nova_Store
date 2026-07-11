const express = require('express');
const logger = require('./utils/logger');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const crypto = require('crypto');
const csrfProtection = require('./middlewares/csrf.middleware');

const adminUploadRoutes = require('./routes/admin/upload.routes');
const currencyRoutes = require('./routes/currency.routes');

const { authLimiter, adminLoginLimiter, swaggerLoginLimiter, resetLimiter, refreshLimiter, adminLimiter, apiLimiter, healthLimiter } = require('./middlewares/rate-limit.middleware');
const cookieParser = require('cookie-parser');
const requestIdMiddleware = require('./middlewares/request-id.middleware');
const requestLogger = require('./middlewares/request-logger.middleware');
const errorMiddleware = require('./middlewares/error.middleware');
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const onboardingRoutes = require('./routes/onboarding.routes');
const roleRoutes = require('./routes/role.routes');
const permissionRoutes = require('./routes/permission.routes');
const userRoleRoutes = require('./routes/user-role.routes');
const productRoutes = require('./routes/product.routes');
const categoryRoutes = require('./routes/product-category.routes');
const brandRoutes = require('./routes/product-brand.routes');
const attributeRoutes = require('./routes/attribute.routes');
const inventoryRoutes = require('./routes/inventory.routes');
const cartRoutes = require('./routes/cart.routes');
const wishlistRoutes = require('./routes/wishlist.routes');
const checkoutRoutes = require('./routes/checkout.routes');
const paymentRoutes = require('./routes/payment.routes');
const orderRoutes = require('./routes/order.routes');
const shippingRoutes = require('./routes/shipping.routes');
const adminShippingRoutes = require('./routes/admin/shipping.routes');
const reviewRoutes = require('./routes/review.routes');
const adminReviewRoutes = require('./routes/admin/review.routes');
const adminReviewReportRoutes = require('./routes/admin/review-report.routes');
const reportRoutes = require('./routes/report.routes');
const couponRoutes = require('./routes/coupon.routes');
const telemetryRoutes = require('./routes/telemetry.routes');
const adminCouponRoutes = require('./routes/admin/coupon.routes');
const notificationRoutes = require('./routes/notification.routes');
const adminNotificationRoutes = require('./routes/admin/notification.routes');
const adminAnalyticsRoutes = require('./routes/admin/analytics.routes');
const adminSalesRoutes = require('./routes/admin/sales.routes');
const adminDashboardRoutes = require('./routes/admin/dashboard.routes');
const adminUserRoutes = require('./routes/admin/user.routes');
const publicSettingRoutes = require('./routes/public/setting.routes');
const adminSettingRoutes = require('./routes/admin/setting.routes');
const healthRoutes = require('./routes/health.routes');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const xssSanitize = require('./middlewares/sanitize.middleware');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { Pool } = require('pg');
const requireAdmin = require('./middlewares/require-admin.middleware');
const storeContext = require('./middlewares/store-context.middleware');
const adminAuthRoutes = require('./routes/admin/auth.routes');
const idempotencyMiddleware = require('./middlewares/idempotency.middleware');
const invitationRoutes = require('./routes/admin/invitation.routes');
const adminManagementRoutes = require('./routes/admin/admin-management.routes');
const acceptInviteRoutes = require('./routes/public/accept-invite.routes');
const swaggerAuth = require('./middlewares/swagger-auth.middleware');

const { metricsMiddleware } = require('./middlewares/metrics.middleware');
const compression = require('compression');
const requestTimeout = require('./middlewares/timeout.middleware');
const pgPool = require('./config/db');

const app = express();
app.set('trust proxy', 1);

app.use(compression());
app.use(requestTimeout(15000));

app.use(requestIdMiddleware);
app.use(metricsMiddleware);
app.use(requestLogger);

const maintenanceMiddleware = require('./middlewares/maintenance.middleware');
const { optionalAuth } = require('./middlewares/auth.middleware');
const auditContext = require('./middlewares/audit-context.middleware');
app.use(optionalAuth);
app.use(auditContext);
app.use(maintenanceMiddleware);

// Dedicated session pool with a short connection timeout so an unreachable
// database fails fast instead of blocking every request for 10+ seconds.
const sessionPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  connectionTimeoutMillis: 10000, // give up after 10s
  idleTimeoutMillis: 30000,
  ssl: { rejectUnauthorized: false },
});

// Build session store — fall back to in-memory if DB is unreachable on startup.
let sessionStore;
try {
  sessionStore = new pgSession({
    pool: sessionPool,
    tableName: 'admin_sessions',
    pruneSessionInterval: 60 * 60,
    errorLog: (...args) => logger.warn('Session store error:', ...args),
  });
} catch (e) {
  logger.warn('Session store could not be initialised, falling back to MemoryStore');
  sessionStore = new session.MemoryStore();
}

app.use(session({
  store: sessionStore,
  secret: process.env.SESSION_SECRET.split(','),
  resave: false,
  saveUninitialized: false,
  name: 'connect.sid',
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 8 * 60 * 60 * 1000,
  },
}));

app.use((req, res, next) => {
  res.locals.nonce = crypto.randomBytes(16).toString('base64');
  next();
});

const adminOrigins = process.env.ADMIN_ALLOWED_ORIGINS
  ? process.env.ADMIN_ALLOWED_ORIGINS.split(',').map(u => u.trim().replace(/\/$/, ''))
  : ['http://localhost:5174'];

const storefrontOrigins = process.env.STOREFRONT_ALLOWED_ORIGINS
  ? process.env.STOREFRONT_ALLOWED_ORIGINS.split(',').map(u => u.trim().replace(/\/$/, ''))
  : ['http://localhost:5173'];

const allowedOrigins = [...adminOrigins, ...storefrontOrigins];

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", (req, res) => `'nonce-${res.locals.nonce}'`, ...allowedOrigins],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", ...allowedOrigins],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      baseUri: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  dnsPrefetchControl: { allow: false },
  frameguard: { action: 'deny' },
  hidePoweredBy: true,
  hsts: true,
  ieNoOpen: true,
  noSniff: true,
  permittedCrossDomainPolicies: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xssFilter: true
}));

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    const normalizedOrigin = origin.replace(/\/$/, '');
    if (allowedOrigins.indexOf(normalizedOrigin) === -1) {
      return callback(null, false); // Or pass an Error: new Error('CORS blocked')
    }
    return callback(null, true);
  },
  credentials: true,
  maxAge: 86400, // Cache preflight requests for 24 hours
}));

app.use('/api/v1/admin/login', adminLoginLimiter);
app.use('/api/v1/auth/login', authLimiter);
app.use('/api/v1/auth/register', authLimiter);
app.use('/api/v1/auth/forgot-password', resetLimiter);
app.use('/api/v1/auth/refresh-token', refreshLimiter);
app.use('/api/v1/admin', adminLimiter);
app.use('/api/v1', apiLimiter);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());
app.use(xssSanitize);
app.use(idempotencyMiddleware);
app.use(csrfProtection);
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/api-docs/login', (req, res, next) => {
  if (req.method === 'POST') {
    return swaggerLoginLimiter(req, res, next);
  }
  next();
});

app.use('/api-docs', swaggerAuth, swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use('/health', healthLimiter, healthRoutes);

app.use('/api/v1', storeContext);
app.use('/api/v1/admin', adminAuthRoutes);
app.use('/api/v1/admin', requireAdmin);
app.use('/api/v1/admin', storeContext);
app.use('/api/v1/admin/sessions', require('./routes/admin/session.routes'));
app.use('/api/v1/admin/migrations', require('./routes/admin/migration.routes'));
app.use('/api/v1/admin/audit', require('./routes/admin/audit.routes'));
app.use('/api/v1/admin/users', adminUserRoutes);
app.use('/api/v1/admin/shipping', adminShippingRoutes);
app.use('/api/v1/admin/reviews', adminReviewRoutes);
app.use('/api/v1/admin/review-reports', adminReviewReportRoutes);
app.use('/api/v1/admin/coupons', adminCouponRoutes);
app.use('/api/v1/admin/notifications', adminNotificationRoutes);
app.use('/api/v1/admin/analytics', adminAnalyticsRoutes);
app.use('/api/v1/admin/sales', adminSalesRoutes);
app.use('/api/v1/admin/dashboard', adminDashboardRoutes);
app.use('/api/v1/admin/settings', adminSettingRoutes);
app.use('/api/v1/admin/store', require('./routes/admin/store.routes'));
app.use('/api/v1/admin/upload', adminUploadRoutes);
app.use('/api/v1/admin/invitations', invitationRoutes);
// Access routes (incl. /stream) MUST be registered before adminManagementRoutes,
// whose GET /:id catch-all would otherwise swallow /admin/stream.
app.use('/api/v1/admin', require('./routes/admin/access.routes'));
app.use('/api/v1/admin', adminManagementRoutes);
app.use('/api/v1/accept-invite', acceptInviteRoutes);

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/user', userRoutes);
app.use('/api/v1/onboarding', onboardingRoutes);
app.use('/api/v1/roles', roleRoutes);
app.use('/api/v1/permissions', permissionRoutes);
app.use('/api/v1/user-routes', userRoleRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/categories', categoryRoutes);
app.use('/api/v1/brands', brandRoutes);
app.use('/api/v1', attributeRoutes);
app.use('/api/v1/inventory', inventoryRoutes);
app.use('/api/v1/cart', cartRoutes);
app.use('/api/v1/wishlist', wishlistRoutes);
app.use('/api/v1/checkout', checkoutRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/shipping', shippingRoutes);
app.use('/api/v1/reviews', reviewRoutes);
app.use('/api/v1/review-reports', reportRoutes);
app.use('/api/v1/coupons', couponRoutes);
app.use('/api/v1/analytics', telemetryRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/settings', publicSettingRoutes);
app.use('/api/v1/currencies', currencyRoutes);
app.use('/api/v1/health', healthLimiter, healthRoutes);

app.use(errorMiddleware);

module.exports = app;
