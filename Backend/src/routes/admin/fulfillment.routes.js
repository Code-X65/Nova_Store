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

/**
 * @swagger
 * /admin/fulfillment/providers:
 *   get:
 *     summary: List 3PL fulfillment providers
 *     tags: [Fulfillment]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/providers',
  hasPermission('fulfillment:read'),
  controller.listProviders
);

/**
 * @swagger
 * /admin/fulfillment/providers:
 *   post:
 *     summary: Create a fulfillment provider
 *     tags: [Fulfillment]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, code]
 *             properties:
 *               name: { type: string }
 *               code: { type: string }
 *               adapter: { type: string, description: "Adapter identifier used to integrate with the provider" }
 *               isEnabled: { type: boolean }
 *               config: { type: object, description: "Provider-specific configuration" }
 *               webhookSecret: { type: string }
 *     responses:
 *       201:
 *         description: Provider created
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.post('/providers',
  hasPermission('fulfillment:write'),
  controller.createProvider
);

/**
 * @swagger
 * /admin/fulfillment/providers/{id}:
 *   patch:
 *     summary: Update a fulfillment provider
 *     tags: [Fulfillment]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Provider ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               code: { type: string }
 *               adapter: { type: string }
 *               isEnabled: { type: boolean }
 *               config: { type: object }
 *               webhookSecret: { type: string }
 *     responses:
 *       200:
 *         description: Provider updated
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 */
router.patch('/providers/:id',
  hasPermission('fulfillment:write'),
  controller.updateProvider
);

/**
 * @swagger
 * /admin/fulfillment/shipments:
 *   post:
 *     summary: Create a shipment with a fulfillment provider
 *     tags: [Fulfillment]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [orderId, providerId]
 *             properties:
 *               orderId: { type: string, format: uuid }
 *               providerId: { type: string, format: uuid }
 *               payload: { type: object, description: "Provider-specific shipment payload" }
 *     responses:
 *       201:
 *         description: Shipment created
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.post('/shipments',
  hasPermission('fulfillment:write'),
  controller.createShipment
);

/**
 * @swagger
 * /admin/fulfillment/shipments:
 *   get:
 *     summary: List shipments
 *     tags: [Fulfillment]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: orderId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: status
 *         schema: { type: string }
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
router.get('/shipments',
  hasPermission('fulfillment:read'),
  controller.listShipments
);

module.exports = router;
