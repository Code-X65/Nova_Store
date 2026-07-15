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

/**
 * @swagger
 * /admin/returns:
 *   get:
 *     summary: List RMAs (returns)
 *     tags: [Returns]
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
  hasPermission('returns:read'),
  controller.list
);

/**
 * @swagger
 * /admin/returns/orders/{id}:
 *   get:
 *     summary: Get RMAs for a specific order
 *     tags: [Returns]
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
  hasPermission('returns:read'),
  controller.getForOrder
);

/**
 * @swagger
 * /admin/returns:
 *   post:
 *     summary: Open a new RMA (return merchandise authorization)
 *     tags: [Returns]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [orderId]
 *             properties:
 *               orderId: { type: string, format: uuid }
 *               reason: { type: string }
 *               condition: { type: string, description: "Reported condition of the item(s) being returned" }
 *               returnMethod: { type: string, description: "e.g. mail, drop_off" }
 *               refundAmount: { type: number }
 *     responses:
 *       201:
 *         description: RMA opened
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.post('/',
  hasPermission('returns:write'),
  controller.create
);

/**
 * @swagger
 * /admin/returns/{id}/transition:
 *   post:
 *     summary: Transition an RMA to a new lifecycle state
 *     tags: [Returns]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: RMA ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [action]
 *             properties:
 *               action: { type: string, description: "Transition action to apply to the RMA lifecycle" }
 *               note: { type: string }
 *               condition: { type: string }
 *               qcOutcome: { type: string, description: "Quality-control outcome" }
 *               refundAmount: { type: number }
 *     responses:
 *       200:
 *         description: RMA transitioned
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 */
router.post('/:id/transition',
  hasPermission('returns:write'),
  controller.transition
);

/**
 * @swagger
 * /admin/returns/{id}/label:
 *   post:
 *     summary: Generate a return shipping label for an RMA
 *     tags: [Returns]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: RMA ID
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               carrier: { type: string }
 *               trackingNumber: { type: string }
 *     responses:
 *       201:
 *         description: Return label generated
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 */
router.post('/:id/label',
  hasPermission('returns:write'),
  controller.generateLabel
);

/**
 * @swagger
 * /admin/returns/{id}/labels:
 *   get:
 *     summary: List return shipping labels generated for an RMA
 *     tags: [Returns]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: RMA ID
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
router.get('/:id/labels',
  hasPermission('returns:read'),
  controller.listLabels
);

module.exports = router;
