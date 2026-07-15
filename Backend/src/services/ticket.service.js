const TicketModel = require('../models/ticket.model');
const CommsLogModel = require('../models/comms-log.model');
const NotificationService = require('./notification.service');
const AuditService = require('./audit.service');

class TicketService {
  async listTickets(filters, pagination) {
    return await TicketModel.findAll(filters, pagination);
  }

  async getTicket(id) {
    return await TicketModel.findById(id);
  }

  async getTicketByNumber(ticketNumber) {
    return await TicketModel.findByTicketNumber(ticketNumber);
  }

  async createTicket(ticket, req = null) {
    const ticketNumber = `TKT-${Date.now().toString(36).toUpperCase()}`;
    const data = await TicketModel.create({ ...ticket, ticket_number: ticketNumber });
    if (req) await AuditService.log(req, 'ticket.created', 'ticket', data.id, null, data, { actionType: 'CREATE' });
    if (data.assigned_to) {
      this.notifyTicketAssigned(data, { id: data.assigned_to });
    }
    return data;
  }

  async updateTicket(id, updates, req = null) {
    const existing = await TicketModel.findById(id);
    const data = await TicketModel.update(id, updates);
    if (req) await AuditService.log(req, 'ticket.updated', 'ticket', id, existing, data, { actionType: 'UPDATE' });
    if (updates.assigned_to && updates.assigned_to !== existing?.assigned_to) {
      this.notifyTicketAssigned(data, { id: updates.assigned_to });
    }
    return data;
  }

  async listMessages(ticketId, pagination) {
    return await TicketModel.getMessages(ticketId, pagination);
  }

  async addMessage(ticketId, message, req = null) {
    const data = await TicketModel.addMessage({ ...message, ticket_id: ticketId });
    if (req) await AuditService.log(req, 'ticket.message.added', 'ticket', ticketId, null, data, { actionType: 'CREATE' });
    return data;
  }

  async getBreachingSla(limit = 20) {
    return await TicketModel.getBreachingSla(limit);
  }

  async logCustomerComms(log, req = null) {
    const data = await CommsLogModel.create(log);
    if (req) await AuditService.log(req, 'comms.sent', 'comms', data.id, null, data, { actionType: 'CREATE' });
    return data;
  }

  async notifyTicketAssigned(ticket, agent) {
    try {
      await NotificationService.sendToUser(agent.id, 'ticket.assigned', {
        ticketNumber: ticket.ticket_number,
        subject: ticket.subject,
      }, 'New Ticket Assigned', `You have been assigned ticket ${ticket.ticket_number}: ${ticket.subject}`);
    } catch (err) {
      console.error('[TicketService] notifyTicketAssigned failed:', err);
    }
  }
}

module.exports = new TicketService();
