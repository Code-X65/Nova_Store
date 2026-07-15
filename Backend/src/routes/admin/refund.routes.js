const express = require('express');
const RefundController = require('../../controllers/admin/refund.controller');
const { hasPermission } = require('../../middlewares/permission.middleware');

const router = express.Router();
const controller = RefundController;

/**
 * @swagger
 * tags:
 *   - name: Refunds
 *     description: Refund management with finance:approve gate (Phase 4 §5.3)
 */

/**
 * @swagger
 * /admin/refunds:
 *   get:
 *     summary: List refunds
 *     tags: [Refunds]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *       - in: query
 *         name: orderId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Success
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/',
  hasPermission('finance:read'),
  controller.list
);

/**
 * @swagger
 * /admin/refunds/orders/{id}:
 *   get:
 *     summary: Get refunds for a specific order
 *     tags: [Refunds]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Order ID
 *     responses:
 *       200:
 *         description: Success
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 */
router.get('/orders/:id',
  hasPermission('finance:read'),
  controller.getForOrder
);

/**
 * @swagger
 * /admin/refunds:
 *   post:
 *     summary: Create a refund request (pending approval)
 *     tags: [Refunds]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [orderId, amount]
 *             properties:
 *               orderId: { type: string, format: uuid }
 *               amount: { type: number }
 *               reason: { type: string }
 *               method: { type: string, description: "Refund method, e.g. original_payment, wallet" }
 *               notes: { type: string }
 *     responses:
 *       201:
 *         description: Refund created (pending approval)
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.post('/',
  hasPermission('finance:write'),
  controller.create
);

/**
 * @swagger
 * /admin/refunds/{id}/process:
 *   post:
 *     summary: Approve and process a pending refund
 *     tags: [Refunds]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Refund ID
 *     responses:
 *       200:
 *         description: Refund processed
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 *       502:
 *         description: Upstream payment provider error
 */
router.post('/:id/process',
  hasPermission('finance:approve'),
  controller.process
);

/**
 * @swagger
 * /admin/refunds/{id}/cancel:
 *   post:
 *     summary: Cancel a pending refund
 *     tags: [Refunds]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Refund ID
 *     responses:
 *       200:
 *         description: Refund cancelled
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 */
router.post('/:id/cancel',
  hasPermission('finance:approve'),
  controller.cancel
);

module.exports = router;
