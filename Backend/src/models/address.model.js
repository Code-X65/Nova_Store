const supabase = require('../config/supabase');

class AddressModel {
  async create(addressData) {
    const { data, error } = await supabase
      .from('addresses')
      .insert([addressData])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async findByUserId(userId) {
    const { data, error } = await supabase
      .from('addresses')
      .select('*')
      .eq('user_id', userId)
      .order('is_default', { ascending: false });

    if (error) throw error;
    return data;
  }

  async findById(id) {
    const { data, error } = await supabase
      .from('addresses')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  }

  async update(id, updateData) {
    const { data, error } = await supabase
      .from('addresses')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async delete(id) {
    const { error } = await supabase
      .from('addresses')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  }

  async unsetDefaults(userId) {
    const { error } = await supabase
      .from('addresses')
      .update({ is_default: false })
      .eq('user_id', userId);

    if (error) throw error;
    return true;
  }
}

module.exports = new AddressModel();
