const express = require('express');
const router = express.Router();
const analyticsController = require('../../controllers/admin/analytics.admin.controller');
const requireAdmin = require('../../middlewares/require-admin.middleware');
const { hasPermission } = require('../../middlewares/permission.middleware');

router.use(requireAdmin);

/**
 * @swagger
 * tags:
 *   name: Admin Dashboard
 *   description: Department-specific dashboard statistical endpoints
 */

/**
 * @swagger
 * /admin/dashboard/order-stats:
 *   get:
 *     summary: Get order statistics for dashboard
 *     tags: [Admin Dashboard]
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
router.get('/order-stats', hasPermission('order:read'), analyticsController.getOrders);

/**
 * @swagger
 * /admin/dashboard/inventory-stats:
 *   get:
 *     summary: Get low stock alerts and inventory stats for dashboard
 *     tags: [Admin Dashboard]
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
router.get('/inventory-stats', hasPermission('inventory:read'), analyticsController.getInventory);

module.exports = router;
