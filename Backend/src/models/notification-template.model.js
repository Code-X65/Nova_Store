const supabase = require('../config/supabase');

class NotificationTemplateModel {
  async findAll() {
    const { data, error } = await supabase
      .from('notification_templates')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;
    return data;
  }

  async findByKey(key) {
    const { data, error } = await supabase
      .from('notification_templates')
      .select('*')
      .eq('key', key)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async create(data) {
    const { data: created, error } = await supabase
      .from('notification_templates')
      .insert([data])
      .select()
      .single();

    if (error) throw error;
    return created;
  }

  async update(id, updateData) {
    updateData.updated_at = new Date().toISOString();
    const { data, error } = await supabase
      .from('notification_templates')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async delete(id) {
    const { error } = await supabase
      .from('notification_templates')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  }
}

module.exports = new NotificationTemplateModel();
