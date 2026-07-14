const TicketService = require('../../services/ticket.service');

class TicketAdminController {
  async listTickets(req, res, next) {
    try {
      const { page, limit, status, priority, assigned_to, customer_id, category, breaching } = req.query;
      const result = await TicketService.listTickets({ status, priority, assigned_to, customer_id, category, breaching }, { page: page || 1, limit: limit || 20 });
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  async getTicket(req, res, next) {
    try {
      const ticket = await TicketService.getTicket(req.params.id);
      const messages = await TicketService.listMessages(req.params.id, { page: 1, limit: 100 });
      res.status(200).json({ success: true, data: ticket, messages: messages.messages });
    } catch (error) {
      next(error);
    }
  }

  async createTicket(req, res, next) {
    try {
      const { subject, description, priority, assignedTo, category, orderId, customerId, slaHours } = req.body;
      if (!subject) return res.status(400).json({ success: false, message: 'Subject is required' });
      const slaDueAt = slaHours ? new Date(Date.now() + slaHours * 60 * 60 * 1000).toISOString() : null;
      const ticket = await TicketService.createTicket({
        subject,
        description,
        priority: priority || 'medium',
        assigned_to: assignedTo || null,
        category: category || null,
        order_id: orderId || null,
        customer_id: customerId || null,
        sla_due_at: slaDueAt,
      }, req);
      res.status(201).json({ success: true, data: ticket, message: 'Ticket created' });
    } catch (error) {
      next(error);
    }
  }

  async updateTicket(req, res, next) {
    try {
      const ticket = await TicketService.updateTicket(req.params.id, req.body, req);
      res.status(200).json({ success: true, data: ticket, message: 'Ticket updated' });
    } catch (error) {
      next(error);
    }
  }

  async addMessage(req, res, next) {
    try {
      const { message, sender_type, is_internal } = req.body;
      if (!message) return res.status(400).json({ success: false, message: 'Message is required' });
      const msg = await TicketService.addMessage(req.params.id, {
        message,
        sender_id: req.admin?.id || req.user?.id || null,
        sender_type: sender_type || 'agent',
        is_internal: is_internal || false,
      }, req);
      res.status(201).json({ success: true, data: msg, message: 'Message added' });
    } catch (error) {
      next(error);
    }
  }

  async listMessages(req, res, next) {
    try {
      const { page, limit } = req.query;
      const result = await TicketService.listMessages(req.params.id, { page: page || 1, limit: limit || 50 });
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  async getBreachingSla(req, res, next) {
    try {
      const tickets = await TicketService.getBreachingSla();
      res.status(200).json({ success: true, data: tickets });
    } catch (error) {
      next(error);
    }
  }

  async logComms(req, res, next) {
    try {
      const { customerId, channel, subject, body } = req.body;
      const log = await TicketService.logCustomerComms({
        customer_id: customerId,
        channel: channel || 'email',
        subject,
        body,
        sent_by: req.admin?.id || req.user?.id || null,
      }, req);
      res.status(201).json({ success: true, data: log, message: 'Communication logged' });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new TicketAdminController();
