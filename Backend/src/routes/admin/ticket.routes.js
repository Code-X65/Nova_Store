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

router.get('/', hasPermission('ticket:read'), ticketController.listTickets);

router.post('/', hasPermission('ticket:write'), ticketController.createTicket);

router.get('/breaching-sla', hasPermission('ticket:read'), ticketController.getBreachingSla);

router.get('/:id', hasPermission('ticket:read'), ticketController.getTicket);

router.put('/:id', hasPermission('ticket:write'), ticketController.updateTicket);

router.post('/:id/messages', hasPermission('ticket:write'), ticketController.addMessage);

router.get('/:id/messages', hasPermission('ticket:read'), ticketController.listMessages);

router.post('/comms', hasPermission('ticket:write'), ticketController.logComms);

module.exports = router;
