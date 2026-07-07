const supabase = require('../config/supabase');

class StoreModel {
  async findById(id) {
    const { data, error } = await supabase
      .from('stores')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  }

  async findBySlug(slug) {
    const { data, error } = await supabase
      .from('stores')
      .select('*')
      .eq('slug', slug)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  }

  async getDefaultStore() {
    // Defaults to 'nova-store' slug
    const store = await this.findBySlug('nova-store');
    if (store) return store;

    // Fallback: pick any store
    const { data, error } = await supabase
      .from('stores')
      .select('*')
      .limit(1);

    if (error) throw error;
    return data && data.length > 0 ? data[0] : null;
  }

  async findUserStore(userId) {
    const { data: user, error } = await supabase
      .from('users')
      .select('store_id')
      .eq('id', userId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    if (user && user.store_id) {
      return await this.findById(user.store_id);
    }

    return await this.getDefaultStore();
  }

  async getSettings(storeId) {
    const { data, error } = await supabase
      .from('store_settings')
      .select('*')
      .eq('store_id', storeId);

    if (error) throw error;
    return data || [];
  }

  async getSettingByKey(storeId, key) {
    const { data, error } = await supabase
      .from('store_settings')
      .select('*')
      .eq('store_id', storeId)
      .eq('key', key)
      .maybeSingle();

    if (error) throw error;
    return data || null;
  }

  async updateSetting(storeId, key, value) {
    const { data, error } = await supabase
      .from('store_settings')
      .upsert({ store_id: storeId, key, value })
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}

module.exports = new StoreModel();
