const express = require('express');
const router = express.Router();
const analyticsController = require('../../controllers/admin/analytics.admin.controller');
const orderController = require('../../controllers/order.controller');
const requireAdmin = require('../../middlewares/require-admin.middleware');
const { hasAnyPermission } = require('../../middlewares/permission.middleware');

router.use(requireAdmin);

/**
 * @swagger
 * tags:
 *   name: Admin Sales
 *   description: Cross-department sales and order reporting endpoints
 */

/**
 * @swagger
 * /admin/sales/reports:
 *   get:
 *     summary: Get revenue report over time
 *     tags: [Admin Sales]
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
router.get('/reports', hasAnyPermission('analytics:read', 'sales:read'), analyticsController.getRevenue);

/**
 * @swagger
 * /admin/sales/daily-summary:
 *   get:
 *     summary: Get revenue summary for date range
 *     tags: [Admin Sales]
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
router.get('/daily-summary', hasAnyPermission('analytics:read', 'sales:read'), analyticsController.getRevenueSummary);

/**
 * @swagger
 * /admin/sales/top-products:
 *   get:
 *     summary: Get best selling products
 *     tags: [Admin Sales]
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
router.get('/top-products', hasAnyPermission('analytics:read', 'sales:read'), analyticsController.getBestSellers);

/**
 * @swagger
 * /admin/sales/order-tracking:
 *   get:
 *     summary: Track all orders across departments
 *     tags: [Admin Sales]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: List of all orders
 */
router.get('/order-tracking', hasAnyPermission('order:read', 'sales:read'), orderController.getAllOrders);

module.exports = router;
