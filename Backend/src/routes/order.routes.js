const express = require('express');
const orderController = require('../controllers/order.controller');
const { protect } = require('../middlewares/auth.middleware');
const { hasPermission } = require('../middlewares/permission.middleware');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Orders
 *   description: Customer order management
 */

router.use(protect);

/**
 * @swagger
 * /orders:
 *   get:
 *     summary: Get user's orders
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 */
router.get('/', orderController.getMyOrders);

/**
 * @swagger
 * /orders/{id}:
 *   get:
 *     summary: Get order details
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:id', orderController.getOrderDetails);

/**
 * @swagger
 * /orders/{id}/cancel:
 *   post:
 *     summary: Cancel an order
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason: { type: string }
 *     responses:
 *       200:
 *         description: Order cancelled
 */
router.post('/:id/cancel', orderController.cancelOrder);

/**
 * @swagger
 * /orders/{id}/return-request:
 *   post:
 *     summary: Request a return for a delivered order
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason: { type: string }
 *     responses:
 *       200:
 *         description: Return requested
 */
router.post('/:id/return-request', orderController.requestReturn);

/**
 * @swagger
 * /orders/{id}/reorder:
 *   post:
 *     summary: Reorder items from previous order
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:id/reorder', orderController.reorder);

// --- Admin Order Routes ---

/**
 * @swagger
 * /orders/admin/list:
 *   get:
 *     summary: List all orders (Admin)
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 */
router.get('/admin/list', hasPermission('order:read'), orderController.getAllOrders);

/**
 * @swagger
 * /orders/admin/{id}:
 *   patch:
 *     summary: Update order status (Admin)
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 */
router.patch('/admin/:id', hasPermission('order:write'), orderController.updateOrderStatus);

/**
 * @swagger
 * /orders/admin/{id}/ship:
 *   post:
 *     summary: Mark order as shipped (Admin)
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 */
router.post('/admin/:id/ship', hasPermission('order:write'), orderController.shipOrder);

/**
 * @swagger
 * /orders/admin/{id}/deliver:
 *   post:
 *     summary: Mark order as delivered (Admin)
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 */
router.post('/admin/:id/deliver', hasPermission('order:write'), orderController.deliverOrder);

/**
 * @swagger
 * /orders/admin/{id}/return:
 *   post:
 *     summary: Process a return request — approve | reject | complete
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [action]
 *             properties:
 *               action: { type: string, enum: [approve, reject, complete] }
 *               note: { type: string }
 *               refundAmount: { type: number }
 *     responses:
 *       200:
 *         description: Return processed
 */
router.post('/admin/:id/return', hasPermission('order:write'), orderController.processReturn);

module.exports = router;
