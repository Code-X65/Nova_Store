const express = require('express');
const DisputeController = require('../../controllers/admin/dispute.controller');
const { hasPermission, hasAnyPermission } = require('../../middlewares/permission.middleware');

const router = express.Router();
const controller = DisputeController;

/**
 * @swagger
 * tags:
 *   - name: Disputes
 *     description: Buyer↔store dispute workflow with SLA timers (Phase 4 §5.3)
 */

router.get('/',
  hasPermission('disputes:read'),
  controller.list
);

router.post('/',
  hasAnyPermission('disputes:resolve', 'crm:write'),
  controller.create
);

router.post('/:id/assign',
  hasPermission('disputes:resolve'),
  controller.assign
);

router.post('/:id/escalate',
  hasPermission('disputes:resolve'),
  controller.escalate
);

router.post('/:id/resolve',
  hasAnyPermission('disputes:resolve', 'finance:approve'),
  controller.resolve
);

module.exports = router;
