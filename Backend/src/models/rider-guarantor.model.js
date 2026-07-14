const supabase = require('../config/supabase');

class RiderGuarantorModel {
  async findByRiderId(riderId) {
    const { data, error } = await supabase
      .from('rider_guarantors')
      .select('*')
      .eq('rider_id', riderId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async create(data) {
    const { data: guarantor, error } = await supabase
      .from('rider_guarantors')
      .insert([data])
      .select()
      .single();

    if (error) throw error;
    return guarantor;
  }

  async update(id, updates) {
    const { data: guarantor, error } = await supabase
      .from('rider_guarantors')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return guarantor;
  }

  async delete(id) {
    const { error } = await supabase
      .from('rider_guarantors')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  }

  async isFull(riderId) {
    const { count, error } = await supabase
      .from('rider_guarantors')
      .select('*', { count: 'exact', head: true })
      .eq('rider_id', riderId);

    if (error) throw error;
    return (count || 0) >= 2;
  }
}

module.exports = new RiderGuarantorModel();
