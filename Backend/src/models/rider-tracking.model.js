const supabase = require('../config/supabase');

class RiderTrackingModel {
  async createPing(data) {
    const { data: row, error } = await supabase
      .from('rider_location_pings')
      .insert([data])
      .select()
      .single();
    if (error) throw error;
    return row;
  }

  async latestPing(riderId) {
    const { data, error } = await supabase
      .from('rider_location_pings')
      .select('*')
      .eq('rider_id', riderId)
      .order('captured_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  }

  async listPings(filters = {}, pagination = { page: 1, limit: 50 }) {
    const { page, limit } = pagination;
    const offset = (page - 1) * limit;
    let query = supabase
      .from('rider_location_pings')
      .select('*', { count: 'exact' })
      .order('captured_at', { ascending: false });
    if (filters.riderId) query = query.eq('rider_id', filters.riderId);
    if (filters.orderId) query = query.eq('order_id', filters.orderId);
    const { data, error, count } = await query.range(offset, offset + limit - 1);
    if (error) throw error;
    return { pings: data, pagination: { page: parseInt(page), limit: parseInt(limit), total: count || 0, totalPages: Math.ceil((count || 0) / limit) } };
  }

  async recordPod(dispatchId, pod) {
    const { data, error } = await supabase
      .from('delivery_dispatches')
      .update({ ...pod, updated_at: new Date().toISOString() })
      .eq('id', dispatchId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}

module.exports = new RiderTrackingModel();
