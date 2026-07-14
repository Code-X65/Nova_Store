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

router.get('/',
  hasPermission('finance:read'),
  controller.list
);

router.get('/orders/:id',
  hasPermission('finance:read'),
  controller.getForOrder
);

router.post('/',
  hasPermission('finance:write'),
  controller.create
);

router.post('/:id/process',
  hasPermission('finance:approve'),
  controller.process
);

router.post('/:id/cancel',
  hasPermission('finance:approve'),
  controller.cancel
);

module.exports = router;
