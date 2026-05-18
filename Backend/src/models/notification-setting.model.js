const supabase = require('../config/supabase');

class NotificationSettingModel {
  async getSettings(userId) {
    const { data, error } = await supabase
      .from('notification_settings')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;

    // Auto-create defaults if none exist
    if (!data) {
      return await this.createDefault(userId);
    }
    
    return data;
  }

  async createDefault(userId) {
    const { data, error } = await supabase
      .from('notification_settings')
      .insert([{ user_id: userId }])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateSettings(userId, settingsData) {
    settingsData.updated_at = new Date().toISOString();
    
    const { data, error } = await supabase
      .from('notification_settings')
      .upsert({ user_id: userId, ...settingsData }, { onConflict: 'user_id' })
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}

module.exports = new NotificationSettingModel();
