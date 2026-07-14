const express = require('express');
const router = express.Router();
const analyticsController = require('../../controllers/admin/analytics.admin.controller');
const requireAdmin = require('../../middlewares/require-admin.middleware');
const { hasPermission, hasAnyPermission } = require('../../middlewares/permission.middleware');

router.use(requireAdmin);
router.use(hasAnyPermission('analytics:read', 'sales:read'));

/**
 * @swagger
 * tags:
 *   name: Admin Analytics
 *   description: Analytics and reporting endpoints
 */

/**
 * @swagger
 * /admin/analytics/dashboard:
 *   get:
 *     summary: Get dashboard summary metrics
 *     tags: [Admin Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: period
 *         schema: { type: string, enum: [day, week, month, year] }
 *     responses:
 *       200:
 *         description: Dashboard metrics
 */
router.get('/dashboard', analyticsController.getDashboard);

/**
 * @swagger
 * /admin/analytics/revenue:
 *   get:
 *     summary: Get revenue report over time
 *     tags: [Admin Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: groupBy
 *         schema: { type: string, enum: [day, week, month, year] }
 *     responses:
 *       200:
 *         description: Revenue report
 */
router.get('/revenue', analyticsController.getRevenue);

/**
 * @swagger
 * /admin/analytics/revenue/summary:
 *   get:
 *     summary: Get revenue summary for date range
 *     tags: [Admin Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date-time }
 *     responses:
 *       200:
 *         description: Revenue summary
 */
router.get('/revenue/summary', analyticsController.getRevenueSummary);

/**
 * @swagger
 * /admin/analytics/best-sellers:
 *   get:
 *     summary: Get best selling products
 *     tags: [Admin Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: sortBy
 *         schema: { type: string, enum: [quantity, revenue] }
 *       - in: query
 *         name: category
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Best sellers list
 */
router.get('/best-sellers', analyticsController.getBestSellers);

/**
 * @swagger
 * /admin/analytics/users:
 *   get:
 *     summary: Get user growth report
 *     tags: [Admin Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: groupBy
 *         schema: { type: string, enum: [day, week, month, year] }
 *     responses:
 *       200:
 *         description: User growth metrics
 */
router.get('/users', analyticsController.getUsers);

/**
 * @swagger
 * /admin/analytics/orders:
 *   get:
 *     summary: Get order statistics
 *     tags: [Admin Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: groupBy
 *         schema: { type: string, enum: [day, week, month, year] }
 *     responses:
 *       200:
 *         description: Orders stats
 */
router.get('/orders', analyticsController.getOrders);

/**
 * @swagger
 * /admin/analytics/payments:
 *   get:
 *     summary: Get payment provider performance
 *     tags: [Admin Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date-time }
 *     responses:
 *       200:
 *         description: Payment stats
 */
router.get('/payments', analyticsController.getPayments);

/**
 * @swagger
 * /admin/analytics/inventory:
 *   get:
 *     summary: Get low stock alerts
 *     tags: [Admin Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *     responses:
 *       200:
 *         description: Inventory alerts
 */
router.get('/inventory', analyticsController.getInventory);

/**
 * @swagger
 * /admin/analytics/export/revenue:
 *   get:
 *     summary: Export revenue report as CSV
 *     tags: [Admin Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date-time }
 *     responses:
 *       200:
 *         description: CSV file download
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get('/export/revenue', analyticsController.exportRevenue);

/**
 * @swagger
 * /admin/analytics/forecast:
 *   get:
 *     summary: Get sales forecast for a metric
 *     tags: [Admin Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: metric
 *         schema: { type: string, enum: [revenue, orders, customers, aov] }
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date-time }
 *     responses:
 *       200:
 *         description: Forecast data
 */
router.get('/forecast', analyticsController.getForecast);

/**
 * @swagger
 * /admin/analytics/forecast:
 *   post:
 *     summary: Save sales forecast snapshot
 *     tags: [Admin Analytics]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               metric:
 *                 type: string
 *               forecast:
 *                 type: array
 *     responses:
 *       201:
 *         description: Forecast saved
 */
router.post('/forecast', analyticsController.saveForecast);

/**
 * @swagger
 * /admin/analytics/heatmap/product/:productId:
 *   get:
 *     summary: Get customer event heatmap for a product
 *     tags: [Admin Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date-time }
 *     responses:
 *       200:
 *         description: Heatmap events
 */
router.get('/heatmap/product/:productId', analyticsController.getCustomerHeatmap);

/**
 * @swagger
 * /admin/analytics/heatmap/summary:
 *   get:
 *     summary: Get heatmap event summary across all products
 *     tags: [Admin Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date-time }
 *     responses:
 *       200:
 *         description: Heatmap summary
 */
router.get('/heatmap/summary', analyticsController.getHeatmapSummary);

module.exports = router;
