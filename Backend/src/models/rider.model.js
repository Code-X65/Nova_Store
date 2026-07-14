const supabase = require('../config/supabase');
const { SINGLE_STORE_ID } = require('../config/store');

class RiderModel {
  async findAll(filters = {}, pagination = { page: 1, limit: 20 }) {
    const { page, limit } = pagination;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('riders')
      .select('*', { count: 'exact' })
      .eq('store_id', SINGLE_STORE_ID);

    if (filters.is_active !== undefined) query = query.eq('is_active', filters.is_active);
    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.search) {
      query = query.or(`first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`);
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return { riders: data, total: count || 0, page, limit };
  }

  async findById(id) {
    const { data, error } = await supabase
      .from('riders')
      .select('*')
      .eq('id', id)
      .eq('store_id', SINGLE_STORE_ID)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  }

  async findByPhone(phone) {
    const { data, error } = await supabase
      .from('riders')
      .select('*')
      .eq('phone', phone)
      .eq('store_id', SINGLE_STORE_ID)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  }

  async create(riderData) {
    const { data, error } = await supabase
      .from('riders')
      .insert([{ ...riderData, store_id: SINGLE_STORE_ID }])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async update(id, updates) {
    const { data, error } = await supabase
      .from('riders')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('store_id', SINGLE_STORE_ID)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async countPending() {
    const { count, error } = await supabase
      .from('riders')
      .select('*', { count: 'exact', head: true })
      .eq('store_id', SINGLE_STORE_ID)
      .eq('status', 'pending_approval');

    if (error) throw error;
    return count || 0;
  }

  async findPending(filters = {}) {
    let query = supabase
      .from('riders')
      .select('*')
      .eq('store_id', SINGLE_STORE_ID)
      .eq('status', 'pending_approval');

    if (filters.search) {
      query = query.or(`first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`);
    }

    const { data, error } = await query
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async approve(id, approvedBy) {
    const { data, error } = await supabase
      .from('riders')
      .update({
        status: 'live',
        approved_by: approvedBy,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('store_id', SINGLE_STORE_ID)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async suspend(id) {
    const { data, error } = await supabase
      .from('riders')
      .update({
        status: 'suspended',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('store_id', SINGLE_STORE_ID)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateStatus(id, status) {
    const { data, error } = await supabase
      .from('riders')
      .update({
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('store_id', SINGLE_STORE_ID)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async delete(id) {
    const { error } = await supabase
      .from('riders')
      .delete()
      .eq('id', id)
      .eq('store_id', SINGLE_STORE_ID);

    if (error) throw error;
    return true;
  }

  async findActive(filters = {}) {
    let query = supabase
      .from('riders')
      .select('id, first_name, last_name, phone, vehicle_type, is_active, status')
      .eq('store_id', SINGLE_STORE_ID)
      .eq('status', 'live')
      .eq('is_active', true);

    if (filters.search) {
      query = query.or(`first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%`);
    }

    const { data, error } = await query.order('first_name', { ascending: true });

    if (error) throw error;
    return data;
  }
}

module.exports = new RiderModel();
