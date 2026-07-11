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

  async update(id, updates) {
    const { data, error } = await supabase
      .from('stores')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
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
    const { SINGLE_STORE_SLUG } = require('../config/store');
    
    // Always return the single store by its defined slug
    const store = await this.findBySlug(SINGLE_STORE_SLUG);
    if (store) return store;

    // Fallback: pick any store (should only happen if seed fails)
    const { data, error } = await supabase
      .from('stores')
      .select('*')
      .limit(1);

    if (error) throw error;
    return data && data.length > 0 ? data[0] : null;
  }

  async findUserStore(userId) {
    // Single-store system: ignore users.store_id and always return the default store
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
      .upsert({ store_id: storeId, key, value, updated_at: new Date().toISOString() })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async upsertSettings(storeId, settings) {
    if (!settings || settings.length === 0) return;

    const records = settings.map(s => ({
      store_id: storeId,
      key: s.key,
      value: s.value,
      updated_at: new Date().toISOString()
    }));

    const { error } = await supabase
      .from('store_settings')
      .upsert(records, { onConflict: 'store_id,key' });

    if (error) throw error;
  }
}

module.exports = new StoreModel();
