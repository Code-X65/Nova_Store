const supabase = require('../config/supabase');

class SettingModel {
  async getAll(group = null) {
    let query = supabase.from('settings').select('*');
    if (group) query = query.eq('group_name', group);
    
    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  async getPublicSettings() {
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .eq('is_public', true);
    
    if (error) throw error;
    return data;
  }

  async getByKey(key) {
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .eq('key', key)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async update(key, newValue, changedBy = null, changeReason = null) {
    // 1. Get old setting
    const oldSetting = await this.getByKey(key);
    if (!oldSetting) throw new Error(`Setting with key ${key} not found`);

    // 2. Update setting
    const { data: updated, error: updateError } = await supabase
      .from('settings')
      .update({ value: newValue, updated_at: new Date().toISOString() })
      .eq('key', key)
      .select()
      .single();

    if (updateError) throw updateError;

    // 3. Log history
    const { error: historyError } = await supabase
      .from('setting_history')
      .insert([{
        setting_id: oldSetting.id,
        old_value: oldSetting.value,
        new_value: newValue,
        changed_by: changedBy,
        change_reason: changeReason
      }]);

    if (historyError) console.error('Failed to log setting history:', historyError);

    return updated;
  }

  async getHistory(key) {
    const setting = await this.getByKey(key);
    if (!setting) throw new Error(`Setting with key ${key} not found`);

    const { data, error } = await supabase
      .from('setting_history')
      .select('*, users(email)')
      .eq('setting_id', setting.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }
}

module.exports = new SettingModel();
