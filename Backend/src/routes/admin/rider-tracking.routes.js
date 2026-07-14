const express = require('express');
const RiderTrackingController = require('../../controllers/admin/rider-tracking.controller');
const { hasPermission, hasAnyPermission } = require('../../middlewares/permission.middleware');

const router = express.Router();
const controller = RiderTrackingController;

/**
 * @swagger
 * tags:
 *   - name: Rider Tracking
 *     description: Live rider location pings, routes & proof-of-delivery (Phase 5 §7.2)
 */

// Rider emits a live location ping (rider app / logistics)
router.post('/:id/ping',
  hasAnyPermission('logistics:write', 'rider:write'),
  controller.ping
);

// Latest known location for a rider
router.get('/:id/location',
  hasPermission('logistics:read'),
  controller.latest
);

// Live route (ping history) for an order's rider
router.get('/orders/:id/track',
  hasPermission('logistics:read'),
  controller.route
);

// Record proof-of-delivery (photo/signature/geo pin)
router.post('/dispatches/:id/pod',
  hasAnyPermission('logistics:write', 'rider:write'),
  controller.recordPod
);

module.exports = router;
