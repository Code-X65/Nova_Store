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

/**
 * @swagger
 * /admin/disputes:
 *   get:
 *     summary: List disputes
 *     tags: [Disputes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *       - in: query
 *         name: priority
 *         schema: { type: string }
 *       - in: query
 *         name: breaching
 *         schema: { type: string, enum: ['true', 'false'] }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: List of disputes
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/',
  hasPermission('disputes:read'),
  controller.list
);

/**
 * @swagger
 * /admin/disputes:
 *   post:
 *     summary: Open a new buyer/store dispute
 *     tags: [Disputes]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [orderId, subject]
 *             properties:
 *               orderId: { type: string, format: uuid }
 *               subject: { type: string }
 *               description: { type: string }
 *               priority: { type: string }
 *               assignedTo: { type: string, format: uuid }
 *               slaDueAt: { type: string, format: date-time }
 *     responses:
 *       201:
 *         description: Dispute opened
 *       400:
 *         description: orderId and subject are required
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.post('/',
  hasAnyPermission('disputes:resolve', 'crm:write'),
  controller.create
);

/**
 * @swagger
 * /admin/disputes/{id}/assign:
 *   post:
 *     summary: Assign a dispute to an admin/agent
 *     tags: [Disputes]
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
 *             required: [assignedTo]
 *             properties:
 *               assignedTo: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Dispute assigned
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 */
router.post('/:id/assign',
  hasPermission('disputes:resolve'),
  controller.assign
);

/**
 * @swagger
 * /admin/disputes/{id}/escalate:
 *   post:
 *     summary: Escalate a dispute
 *     tags: [Disputes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Dispute escalated
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 */
router.post('/:id/escalate',
  hasPermission('disputes:resolve'),
  controller.escalate
);

/**
 * @swagger
 * /admin/disputes/{id}/resolve:
 *   post:
 *     summary: Resolve a dispute
 *     tags: [Disputes]
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
 *             properties:
 *               resolution: { type: string }
 *               resolutionNotes: { type: string }
 *               status: { type: string }
 *     responses:
 *       200:
 *         description: Dispute resolved
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 */
router.post('/:id/resolve',
  hasAnyPermission('disputes:resolve', 'finance:approve'),
  controller.resolve
);

module.exports = router;
