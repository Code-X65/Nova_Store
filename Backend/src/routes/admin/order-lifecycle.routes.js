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

// List valid next transitions for an order
router.get('/:id/transitions',
  hasPermission('order:read'),
  controller.allowedTransitions
);

// Perform a validated state-machine transition
router.post('/:id/transition',
  hasAnyPermission('order:write', 'order:approve'),
  controller.transition
);

module.exports = router;
