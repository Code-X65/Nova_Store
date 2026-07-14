const supabase = require('../config/supabase');

class TicketModel {
  async findAll(filters = {}, pagination = { page: 1, limit: 20 }) {
    const { page, limit } = pagination;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from('support_tickets')
      .select('*, customer:users!customer_id(id,first_name,last_name,email), assigned:users!assigned_to(id,first_name,last_name,email)', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (filters.status) query = query.eq('status', filters.status);
    if (filters.priority) query = query.eq('priority', filters.priority);
    if (filters.assigned_to) query = query.eq('assigned_to', filters.assigned_to);
    if (filters.customer_id) query = query.eq('customer_id', filters.customer_id);
    if (filters.category) query = query.eq('category', filters.category);
    if (filters.breaching === 'true') query = query.lte('sla_due_at', new Date().toISOString()).neq('status', 'closed').neq('status', 'resolved');

    const { data, error, count } = await query.range(from, to);
    if (error) throw error;
    return { tickets: data || [], total: count || 0, page: Number(page), limit: Number(limit) };
  }

  async findById(id) {
    const { data, error } = await supabase
      .from('support_tickets')
      .select('*, customer:users!customer_id(id,first_name,last_name,email), assigned:users!assigned_to(id,first_name,last_name,email)')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  }

  async findByTicketNumber(ticketNumber) {
    const { data, error } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('ticket_number', ticketNumber)
      .single();
    if (error) throw error;
    return data;
  }

  async create(ticket) {
    const { data, error } = await supabase
      .from('support_tickets')
      .insert([ticket])
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async update(id, updates) {
    const { data, error } = await supabase
      .from('support_tickets')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async getMessages(ticketId, pagination = { page: 1, limit: 50 }) {
    const { page, limit } = pagination;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await supabase
      .from('ticket_messages')
      .select('*, sender:users!sender_id(id,first_name,last_name,email)', { count: 'exact' })
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true })
      .range(from, to);

    if (error) throw error;
    return { messages: data || [], total: count || 0, page: Number(page), limit: Number(limit) };
  }

  async addMessage(message) {
    const { data, error } = await supabase
      .from('ticket_messages')
      .insert([message])
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async getBreachingSla(limit = 20) {
    const { data, error } = await supabase
      .from('support_tickets')
      .select('*')
      .lte('sla_due_at', new Date().toISOString())
      .neq('status', 'closed')
      .neq('status', 'resolved')
      .order('sla_due_at', { ascending: true })
      .limit(limit);
    if (error) throw error;
    return data || [];
  }
}

module.exports = new TicketModel();
