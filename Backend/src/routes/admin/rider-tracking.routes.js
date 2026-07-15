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

/**
 * @swagger
 * /admin/rider-tracking/{id}/ping:
 *   post:
 *     summary: Record a live location ping for a rider
 *     tags: [Rider Tracking]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Rider ID
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [orderId, lat, lng]
 *             properties:
 *               orderId: { type: string, format: uuid }
 *               lat: { type: number, format: float }
 *               lng: { type: number, format: float }
 *               heading: { type: number }
 *               speed: { type: number }
 *               accuracyM: { type: number }
 *               capturedAt: { type: string, format: date-time }
 *     responses:
 *       201:
 *         description: Ping recorded
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
// Rider emits a live location ping (rider app / logistics)
router.post('/:id/ping',
  hasAnyPermission('logistics:write', 'rider:write'),
  controller.ping
);

/**
 * @swagger
 * /admin/rider-tracking/{id}/location:
 *   get:
 *     summary: Get the latest known location for a rider
 *     tags: [Rider Tracking]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Rider ID
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Latest location
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 */
// Latest known location for a rider
router.get('/:id/location',
  hasPermission('logistics:read'),
  controller.latest
);

/**
 * @swagger
 * /admin/rider-tracking/orders/{id}/track:
 *   get:
 *     summary: Get live route (ping history) for an order's rider
 *     tags: [Rider Tracking]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Order ID
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 100 }
 *     responses:
 *       200:
 *         description: Ping history / route
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 */
// Live route (ping history) for an order's rider
router.get('/orders/:id/track',
  hasPermission('logistics:read'),
  controller.route
);

/**
 * @swagger
 * /admin/rider-tracking/dispatches/{id}/pod:
 *   post:
 *     summary: Record proof-of-delivery (photo/signature/geo pin) for a dispatch
 *     tags: [Rider Tracking]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Dispatch ID
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               podPhotoUrl: { type: string, format: uri }
 *               podSignatureUrl: { type: string, format: uri }
 *               lat: { type: number, format: float }
 *               lng: { type: number, format: float }
 *               geofenceEtaAt: { type: string, format: date-time }
 *     responses:
 *       200:
 *         description: Proof of delivery recorded
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 */
// Record proof-of-delivery (photo/signature/geo pin)
router.post('/dispatches/:id/pod',
  hasAnyPermission('logistics:write', 'rider:write'),
  controller.recordPod
);

module.exports = router;
