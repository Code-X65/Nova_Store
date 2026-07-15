const express = require('express');
const router = express.Router();
const ticketController = require('../../controllers/admin/ticket.admin.controller');
const requireAdmin = require('../../middlewares/require-admin.middleware');
const { hasPermission, hasAnyPermission } = require('../../middlewares/permission.middleware');

router.use(requireAdmin);
router.use(hasAnyPermission('ticket:read', 'crm:read'));

/**
 * @swagger
 * tags:
 *   name: Admin Tickets
 *   description: Support tickets and communication log (Phase 7 §9.2 / §9.3)
 */

/**
 * @swagger
 * /admin/tickets:
 *   get:
 *     summary: List support tickets
 *     tags: [Admin Tickets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [open, in_progress, waiting_customer, resolved, closed] }
 *       - in: query
 *         name: priority
 *         schema: { type: string, enum: [low, medium, high, urgent] }
 *       - in: query
 *         name: assigned_to
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: customer_id
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: category
 *         schema: { type: string }
 *       - in: query
 *         name: breaching
 *         schema: { type: boolean }
 *         description: Filter to tickets breaching (or close to breaching) their SLA
 *     responses:
 *       200:
 *         description: List of tickets
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/', hasPermission('ticket:read'), ticketController.listTickets);

/**
 * @swagger
 * /admin/tickets:
 *   post:
 *     summary: Create a support ticket
 *     tags: [Admin Tickets]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [subject]
 *             properties:
 *               subject: { type: string }
 *               description: { type: string }
 *               priority: { type: string, enum: [low, medium, high, urgent], default: medium }
 *               assignedTo: { type: string, format: uuid }
 *               category: { type: string }
 *               orderId: { type: string, format: uuid }
 *               customerId: { type: string, format: uuid }
 *               slaHours: { type: number, description: "Hours until SLA due; used to compute sla_due_at" }
 *     responses:
 *       201:
 *         description: Ticket created
 *       400:
 *         description: Validation error (subject is required)
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.post('/', hasPermission('ticket:write'), ticketController.createTicket);

/**
 * @swagger
 * /admin/tickets/breaching-sla:
 *   get:
 *     summary: List tickets breaching their SLA
 *     tags: [Admin Tickets]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of SLA-breaching tickets
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/breaching-sla', hasPermission('ticket:read'), ticketController.getBreachingSla);

/**
 * @swagger
 * /admin/tickets/{id}:
 *   get:
 *     summary: Get a support ticket by ID, including its messages
 *     tags: [Admin Tickets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Ticket details with messages
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 */
router.get('/:id', hasPermission('ticket:read'), ticketController.getTicket);

/**
 * @swagger
 * /admin/tickets/{id}:
 *   put:
 *     summary: Update a support ticket
 *     tags: [Admin Tickets]
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
 *               subject: { type: string }
 *               description: { type: string }
 *               status: { type: string, enum: [open, in_progress, waiting_customer, resolved, closed] }
 *               priority: { type: string, enum: [low, medium, high, urgent] }
 *               assigned_to: { type: string, format: uuid }
 *               category: { type: string }
 *               order_id: { type: string, format: uuid }
 *               sla_due_at: { type: string, format: date-time }
 *               resolved_at: { type: string, format: date-time }
 *     responses:
 *       200:
 *         description: Ticket updated
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 */
router.put('/:id', hasPermission('ticket:write'), ticketController.updateTicket);

/**
 * @swagger
 * /admin/tickets/{id}/messages:
 *   post:
 *     summary: Add a message to a support ticket
 *     tags: [Admin Tickets]
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
 *             required: [message]
 *             properties:
 *               message: { type: string }
 *               sender_type: { type: string, enum: [customer, agent, system], default: agent }
 *               is_internal: { type: boolean, default: false }
 *     responses:
 *       201:
 *         description: Message added
 *       400:
 *         description: Validation error (message is required)
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 */
router.post('/:id/messages', hasPermission('ticket:write'), ticketController.addMessage);

/**
 * @swagger
 * /admin/tickets/{id}/messages:
 *   get:
 *     summary: List messages for a support ticket
 *     tags: [Admin Tickets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50 }
 *     responses:
 *       200:
 *         description: List of ticket messages
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 */
router.get('/:id/messages', hasPermission('ticket:read'), ticketController.listMessages);

/**
 * @swagger
 * /admin/tickets/comms:
 *   post:
 *     summary: Log an outbound customer communication (email/sms/in_app/push)
 *     tags: [Admin Tickets]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [customerId]
 *             properties:
 *               customerId: { type: string, format: uuid }
 *               channel: { type: string, enum: [email, sms, in_app, push], default: email }
 *               subject: { type: string }
 *               body: { type: string }
 *     responses:
 *       201:
 *         description: Communication logged
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.post('/comms', hasPermission('ticket:write'), ticketController.logComms);

module.exports = router;
