const express = require('express');
const OrderLifecycleController = require('../../controllers/admin/order-lifecycle.controller');
const { hasPermission, hasAnyPermission } = require('../../middlewares/permission.middleware');

const router = express.Router();
const controller = OrderLifecycleController;

/**
 * @swagger
 * tags:
 *   - name: Order Lifecycle
 *     description: Server-enforced order status state machine (Phase 4 §5.1)
 */

/**
 * @swagger
 * /admin/orders/{id}/transitions:
 *   get:
 *     summary: List valid next statuses for an order
 *     tags: [Order Lifecycle]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Allowed next transitions
 *       404:
 *         description: Order not found
 */
// List valid next transitions for an order
router.get('/:id/transitions',
  hasPermission('order:read'),
  controller.allowedTransitions
);

/**
 * @swagger
 * /admin/orders/{id}/transition:
 *   post:
 *     summary: Perform a validated order-status transition
 *     tags: [Order Lifecycle]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [toStatus]
 *             properties:
 *               toStatus: { type: string, description: "Target order status" }
 *               note: { type: string, description: "Required for transitions where requires_note is true" }
 *     responses:
 *       200:
 *         description: Order transitioned successfully
 *       422:
 *         description: Invalid transition for the order's current status
 */
// Perform a validated state-machine transition
router.post('/:id/transition',
  hasAnyPermission('order:write', 'order:approve'),
  controller.transition
);

module.exports = router;
