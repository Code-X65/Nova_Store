const supabase = require('../config/supabase');

class InventoryTransactionModel {
  async create(transactionData) {
    const { data, error } = await supabase
      .from('inventory_transactions')
      .insert([transactionData])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async findByProductId(productId, filters = {}, pagination = { page: 1, limit: 20 }) {
    const { page, limit } = pagination;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('inventory_transactions')
      .select('*, products(name, sku), product_variants(name, sku)', { count: 'exact' })
      .eq('product_id', productId);

    if (filters.store_id) query = query.eq('store_id', filters.store_id);
    if (filters.type) query = query.eq('type', filters.type);
    if (filters.variantId) query = query.eq('variant_id', filters.variantId);

    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) throw error;

    return { transactions: data, total: count };
  }

  async findAll(filters = {}, pagination = { page: 1, limit: 20 }) {
    const { page, limit } = pagination;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('inventory_transactions')
      .select('*, products(name, sku), product_variants(name, sku)', { count: 'exact' });

    if (filters.store_id) query = query.eq('store_id', filters.store_id);
    if (filters.type) query = query.eq('type', filters.type);
    if (filters.productId) query = query.eq('product_id', filters.productId);
    if (filters.userId) query = query.eq('performed_by', filters.userId);

    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) throw error;

    return { 
      transactions: data, 
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        totalPages: Math.ceil(count / limit)
      }
    };
  }

  async getRecentTransactions(limit = 10, storeId = null) {
    let query = supabase
      .from('inventory_transactions')
      .select('*, products(name, sku)')
      .order('created_at', { ascending: false });

    if (storeId) query = query.eq('store_id', storeId);

    const { data, error } = await query.limit(limit);

    if (error) throw error;
    return data;
  }
}

module.exports = new InventoryTransactionModel();
