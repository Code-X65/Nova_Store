const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

const adminUploadRoutes = require('./routes/admin/upload.routes');
const currencyRoutes = require('./routes/currency.routes');

const { authLimiter, adminLoginLimiter, resetLimiter, refreshLimiter, adminLimiter, apiLimiter } = require('./middlewares/rate-limit.middleware');
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
const adminUserRoutes = require('./routes/admin/user.routes');
const publicSettingRoutes = require('./routes/public/setting.routes');
const adminSettingRoutes = require('./routes/admin/setting.routes');
const healthRoutes = require('./routes/health.routes');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const xssSanitize = require('./middlewares/sanitize.middleware');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const requireAdmin = require('./middlewares/require-admin.middleware');
const adminAuthRoutes = require('./routes/admin/auth.routes');
const idempotencyMiddleware = require('./middlewares/idempotency.middleware');

const app = express();
app.set('trust proxy', 1);

app.use(requestIdMiddleware);

const maintenanceMiddleware = require('./middlewares/maintenance.middleware');
const { optionalAuth } = require('./middlewares/auth.middleware');
app.use(optionalAuth);
app.use(maintenanceMiddleware);

app.use(session({
  store: new pgSession({
    conString: process.env.DATABASE_URL,
    tableName: 'admin_sessions',
    pruneSessionInterval: 60 * 60,
  }),
  secret: process.env.SESSION_SECRET || 'CHANGE_ME_IN_PRODUCTION',
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

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", process.env.CLIENT_URL || 'http://localhost:5173'],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", process.env.CLIENT_URL || 'http://localhost:5173'],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      baseUri: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: true,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  dnsPrefetchControl: true,
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
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
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
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

app.use('/api/v1/admin', adminAuthRoutes);
app.use('/api/v1/admin', requireAdmin);
app.use('/api/v1/admin/sessions', require('./routes/admin/session.routes'));
app.use('/api/v1/admin/audit', require('./routes/admin/audit.routes'));
app.use('/api/v1/admin/users', adminUserRoutes);
app.use('/api/v1/admin/shipping', adminShippingRoutes);
app.use('/api/v1/admin/reviews', adminReviewRoutes);
app.use('/api/v1/admin/review-reports', adminReviewReportRoutes);
app.use('/api/v1/admin/coupons', adminCouponRoutes);
app.use('/api/v1/admin/notifications', adminNotificationRoutes);
app.use('/api/v1/admin/analytics', adminAnalyticsRoutes);
app.use('/api/v1/admin/settings', adminSettingRoutes);
app.use('/api/v1/admin/upload', adminUploadRoutes);

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
app.use('/api/v1/health', healthRoutes);

app.use(errorMiddleware);

module.exports = app;
