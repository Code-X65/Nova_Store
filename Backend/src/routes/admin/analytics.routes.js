const express = require('express');
const router = express.Router();
const analyticsController = require('../../controllers/admin/analytics.admin.controller');
const { protect } = require('../../middlewares/auth.middleware');
const { hasPermission } = require('../../middlewares/permission.middleware');

router.use(protect);
// Optional: router.use(hasPermission('analytics:read'));

/**
 * @swagger
 * tags:
 *   name: Admin Analytics
 *   description: Analytics and reporting endpoints
 */

/**
 * @swagger
 * /api/v1/admin/analytics/dashboard:
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
 * /api/v1/admin/analytics/revenue:
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
 * /api/v1/admin/analytics/revenue/summary:
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
 * /api/v1/admin/analytics/best-sellers:
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
 * /api/v1/admin/analytics/users:
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
 * /api/v1/admin/analytics/orders:
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
 * /api/v1/admin/analytics/payments:
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
 * /api/v1/admin/analytics/inventory:
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
 * /api/v1/admin/analytics/export/revenue:
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

module.exports = router;
