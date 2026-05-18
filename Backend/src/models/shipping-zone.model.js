const supabase = require('../config/supabase');

class ShippingZoneModel {
  async findAll(filters = {}) {
    let query = supabase.from('shipping_zones').select('*');

    if (filters.isActive !== undefined) {
      query = query.eq('is_active', filters.isActive);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  }

  async findById(id) {
    const { data, error } = await supabase
      .from('shipping_zones')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async create(zoneData) {
    const { data, error } = await supabase
      .from('shipping_zones')
      .insert([zoneData])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async update(id, zoneData) {
    zoneData.updated_at = new Date().toISOString();
    const { data, error } = await supabase
      .from('shipping_zones')
      .update(zoneData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async delete(id) {
    const { error } = await supabase
      .from('shipping_zones')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  }
}

module.exports = new ShippingZoneModel();
