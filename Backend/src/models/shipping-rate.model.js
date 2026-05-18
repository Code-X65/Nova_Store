const supabase = require('../config/supabase');

class ShippingRateModel {
  async findAll(filters = {}) {
    let query = supabase.from('shipping_rates').select('*, zone:shipping_zones(*)');

    if (filters.isActive !== undefined) {
      query = query.eq('is_active', filters.isActive);
    }
    if (filters.zoneId) {
      query = query.eq('zone_id', filters.zoneId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  }

  async findById(id) {
    const { data, error } = await supabase
      .from('shipping_rates')
      .select('*, zone:shipping_zones(*)')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async findByZoneId(zoneId, filters = {}) {
    let query = supabase.from('shipping_rates').select('*').eq('zone_id', zoneId);
    
    if (filters.isActive !== undefined) {
      query = query.eq('is_active', filters.isActive);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  async create(rateData) {
    const { data, error } = await supabase
      .from('shipping_rates')
      .insert([rateData])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async update(id, rateData) {
    rateData.updated_at = new Date().toISOString();
    const { data, error } = await supabase
      .from('shipping_rates')
      .update(rateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async delete(id) {
    const { error } = await supabase
      .from('shipping_rates')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  }
}

module.exports = new ShippingRateModel();
