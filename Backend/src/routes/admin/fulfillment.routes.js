const express = require('express');
const FulfillmentController = require('../../controllers/admin/fulfillment.controller');
const { hasPermission } = require('../../middlewares/permission.middleware');

const router = express.Router();
const controller = FulfillmentController;

/**
 * @swagger
 * tags:
 *   - name: Fulfillment
 *     description: 3PL provider integrations & shipments (Phase 5 §7.1)
 */

router.get('/providers',
  hasPermission('fulfillment:read'),
  controller.listProviders
);

router.post('/providers',
  hasPermission('fulfillment:write'),
  controller.createProvider
);

router.patch('/providers/:id',
  hasPermission('fulfillment:write'),
  controller.updateProvider
);

router.post('/shipments',
  hasPermission('fulfillment:write'),
  controller.createShipment
);

router.get('/shipments',
  hasPermission('fulfillment:read'),
  controller.listShipments
);

module.exports = router;
