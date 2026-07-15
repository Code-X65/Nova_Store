const supabase = require('../config/supabase');

class CampaignModel {
  async findAll(filters = {}, pagination = { page: 1, limit: 20 }) {
    let query = supabase.from('campaigns').select('*', { count: 'exact' });

    if (filters.isActive !== undefined) query = query.eq('is_active', filters.isActive);
    if (filters.scope) query = query.eq('scope', filters.scope);
    if (filters.name) query = query.ilike('name', `%${filters.name}%`);

    const { page, limit } = pagination;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;
    return { data, count, page, limit };
  }

  async findActive() {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('campaigns')
      .select('*, campaign_products(product_id), campaign_categories(category_id), campaign_brands(brand_id)')
      .eq('is_active', true)
      .lte('starts_at', now)
      .gte('ends_at', now);

    if (error) throw error;
    return data;
  }

  async findById(id) {
    const { data, error } = await supabase
      .from('campaigns')
      .select('*, campaign_products(product_id), campaign_categories(category_id), campaign_brands(brand_id)')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async create(campaignData, { productIds = [], categoryIds = [], brandIds = [] } = {}) {
    const { data, error } = await supabase
      .from('campaigns')
      .insert([campaignData])
      .select()
      .single();

    if (error) throw error;

    await this._syncScopeLinks(data.id, campaignData.scope, { productIds, categoryIds, brandIds });
    return data;
  }

  async update(id, updateData, { productIds, categoryIds, brandIds } = {}) {
    const { data, error } = await supabase
      .from('campaigns')
      .update({ ...updateData, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    if (productIds !== undefined || categoryIds !== undefined || brandIds !== undefined) {
      await this._syncScopeLinks(id, updateData.scope || data.scope, { productIds, categoryIds, brandIds });
    }
    return data;
  }

  async delete(id) {
    const { error } = await supabase.from('campaigns').delete().eq('id', id);
    if (error) throw error;
    return true;
  }

  async _syncScopeLinks(campaignId, scope, { productIds, categoryIds, brandIds }) {
    if (scope === 'products' && productIds) {
      await supabase.from('campaign_products').delete().eq('campaign_id', campaignId);
      if (productIds.length) {
        const rows = productIds.map((product_id) => ({ campaign_id: campaignId, product_id }));
        const { error } = await supabase.from('campaign_products').insert(rows);
        if (error) throw error;
      }
    }
    if (scope === 'category' && categoryIds) {
      await supabase.from('campaign_categories').delete().eq('campaign_id', campaignId);
      if (categoryIds.length) {
        const rows = categoryIds.map((category_id) => ({ campaign_id: campaignId, category_id }));
        const { error } = await supabase.from('campaign_categories').insert(rows);
        if (error) throw error;
      }
    }
    if (scope === 'brand' && brandIds) {
      await supabase.from('campaign_brands').delete().eq('campaign_id', campaignId);
      if (brandIds.length) {
        const rows = brandIds.map((brand_id) => ({ campaign_id: campaignId, brand_id }));
        const { error } = await supabase.from('campaign_brands').insert(rows);
        if (error) throw error;
      }
    }
  }
}

module.exports = new CampaignModel();
