const supabase = require('../config/supabase');

class CommsLogModel {
  async findAll(filters = {}, pagination = { page: 1, limit: 20 }) {
    const { page, limit } = pagination;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from('customer_comms_log')
      .select('*, customer:users!customer_id(id,first_name,last_name,email)', { count: 'exact' })
      .order('sent_at', { ascending: false });

    if (filters.customer_id) query = query.eq('customer_id', filters.customer_id);
    if (filters.channel) query = query.eq('channel', filters.channel);
    if (filters.sent_by) query = query.eq('sent_by', filters.sent_by);
    if (filters.fromDate) query = query.gte('sent_at', filters.fromDate);
    if (filters.toDate) query = query.lte('sent_at', filters.toDate);

    const { data, error, count } = await query.range(from, to);
    if (error) throw error;
    return { logs: data || [], total: count || 0, page: Number(page), limit: Number(limit) };
  }

  async create(log) {
    const { data, error } = await supabase
      .from('customer_comms_log')
      .insert([log])
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}

module.exports = new CommsLogModel();
