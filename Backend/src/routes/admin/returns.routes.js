const express = require('express');
const ReturnsController = require('../../controllers/admin/returns.controller');
const { hasPermission } = require('../../middlewares/permission.middleware');

const router = express.Router();
const controller = ReturnsController;

/**
 * @swagger
 * tags:
 *   - name: Returns
 *     description: Reverse logistics / RMA lifecycle (Phase 5 §7.3)
 */

router.get('/',
  hasPermission('returns:read'),
  controller.list
);

router.get('/orders/:id',
  hasPermission('returns:read'),
  controller.getForOrder
);

router.post('/',
  hasPermission('returns:write'),
  controller.create
);

router.post('/:id/transition',
  hasPermission('returns:write'),
  controller.transition
);

router.post('/:id/label',
  hasPermission('returns:write'),
  controller.generateLabel
);

router.get('/:id/labels',
  hasPermission('returns:read'),
  controller.listLabels
);

module.exports = router;
