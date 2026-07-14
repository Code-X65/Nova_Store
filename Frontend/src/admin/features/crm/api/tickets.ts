import { api } from '@/admin/lib/api';

export interface Ticket {
  id: string;
  ticket_number: string;
  customer_id: string;
  subject: string;
  description?: string;
  status: string;
  priority: string;
  assigned_to?: string;
  category?: string;
  order_id?: string;
  sla_due_at?: string;
  resolved_at?: string;
  created_at: string;
  updated_at: string;
  customer?: { first_name: string; last_name: string; email: string };
  assigned?: { first_name: string; last_name: string; email: string };
}

export interface TicketMessage {
  id: string;
  ticket_id: string;
  sender_id?: string;
  sender_type: string;
  message: string;
  is_internal: boolean;
  attachments: unknown[];
  created_at: string;
}

export async function fetchTickets(params: { page?: number; limit?: number; status?: string; priority?: string; breaching?: boolean } = {}) {
  const { data } = await api.get('/admin/tickets', { params });
  return data;
}

export async function fetchTicket(id: string) {
  const { data } = await api.get(`/admin/tickets/${id}`);
  return data;
}

export async function createTicket(payload: { subject: string; description?: string; priority?: string; assignedTo?: string; category?: string; orderId?: string; customerId?: string; slaHours?: number }) {
  const { data } = await api.post('/admin/tickets', payload);
  return data.data.ticket as Ticket;
}

export async function updateTicket(id: string, payload: { status?: string; priority?: string; assignedTo?: string; category?: string }) {
  const { data } = await api.put(`/admin/tickets/${id}`, payload);
  return data.data.ticket as Ticket;
}

export async function addTicketMessage(ticketId: string, message: string, senderType = 'agent', isInternal = false) {
  const { data } = await api.post(`/admin/tickets/${ticketId}/messages`, { message, sender_type: senderType, is_internal: isInternal });
  return data.data.message as TicketMessage;
}

export async function fetchTicketMessages(ticketId: string, params: { page?: number; limit?: number } = {}) {
  const { data } = await api.get(`/admin/tickets/${ticketId}/messages`, { params });
  return data;
}

export async function fetchBreachingSla() {
  const { data } = await api.get('/admin/tickets/breaching-sla');
  return data.data as Ticket[];
}
