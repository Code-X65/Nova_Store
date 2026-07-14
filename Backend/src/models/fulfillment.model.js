const supabase = require('../config/supabase');
const { SINGLE_STORE_ID } = require('../config/store');

class FulfillmentModel {
  // ── Providers ──────────────────────────────────────────────────────────────
  async createProvider(data) {
    const { data: row, error } = await supabase
      .from('fulfillment_providers')
      .insert([{ ...data, store_id: SINGLE_STORE_ID }])
      .select()
      .single();
    if (error) throw error;
    return row;
  }

  async updateProvider(id, updates) {
    const { data, error } = await supabase
      .from('fulfillment_providers')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('store_id', SINGLE_STORE_ID)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async listProviders() {
    const { data, error } = await supabase
      .from('fulfillment_providers')
      .select('*')
      .eq('store_id', SINGLE_STORE_ID)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async findProvider(id) {
    const { data, error } = await supabase
      .from('fulfillment_providers')
      .select('*')
      .eq('id', id)
      .eq('store_id', SINGLE_STORE_ID)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  }

  async findProviderByCode(code) {
    const { data, error } = await supabase
      .from('fulfillment_providers')
      .select('*')
      .eq('code', code)
      .eq('store_id', SINGLE_STORE_ID)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  }

  // ── Shipments ─────────────────────────────────────────────────────────────
  async createShipment(data) {
    const { data: row, error } = await supabase
      .from('fulfillment_shipments')
      .insert([{ ...data, store_id: SINGLE_STORE_ID }])
      .select()
      .single();
    if (error) throw error;
    return row;
  }

  async updateShipment(id, updates, rawPayload = null) {
    const patch = { ...updates, updated_at: new Date().toISOString() };
    if (rawPayload) patch.raw_payload = rawPayload;
    const { data, error } = await supabase
      .from('fulfillment_shipments')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async findShipment(id) {
    const { data, error } = await supabase
      .from('fulfillment_shipments')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  }

  async listShipments(filters = {}, pagination = { page: 1, limit: 20 }) {
    const { page, limit } = pagination;
    const offset = (page - 1) * limit;
    let query = supabase
      .from('fulfillment_shipments')
      .select('*, provider:fulfillment_providers(name, code)', { count: 'exact' })
      .eq('store_id', SINGLE_STORE_ID);
    if (filters.orderId) query = query.eq('order_id', filters.orderId);
    if (filters.status) query = query.eq('status', filters.status);
    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw error;
    return { shipments: data, pagination: { page: parseInt(page), limit: parseInt(limit), total: count || 0, totalPages: Math.ceil((count || 0) / limit) } };
  }
}

module.exports = new FulfillmentModel();
