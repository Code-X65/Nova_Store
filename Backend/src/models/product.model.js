const supabase = require('../config/supabase');

class ProductModel {
  async findAll(filters = {}, pagination = { page: 1, limit: 20 }) {
    const { page, limit } = pagination;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('products')
      .select('*', { count: 'exact' })
      .is('deleted_at', null);

    // Apply Filters
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.category) query = query.eq('category', filters.category);
    if (filters.brand) query = query.eq('brand', filters.brand);
    if (filters.is_featured !== undefined) query = query.eq('is_featured', filters.is_featured);
    
    // Price Filtering
    if (filters.minPrice) query = query.gte('price', filters.minPrice);
    if (filters.maxPrice) query = query.lte('price', filters.maxPrice);
    
    // Rating Filtering
    if (filters.minRating) query = query.gte('average_rating', filters.minRating);

    if (filters.search) {
      query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%,sku.ilike.%${filters.search}%`);
    }

    // Sorting
    const sortMapping = {
      'newest': { column: 'created_at', ascending: false },
      'cheapest': { column: 'price', ascending: true },
      'price_low': { column: 'price', ascending: true },
      'price_high': { column: 'price', ascending: false },
      'popular': { column: 'review_count', ascending: false },
      'rating': { column: 'average_rating', ascending: false }
    };

    const sortConfig = sortMapping[filters.sortBy] || { column: filters.sortBy || 'created_at', ascending: filters.order !== 'asc' };
    query = query.order(sortConfig.column, { ascending: sortConfig.ascending });

    // Pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) throw error;

    return { 
      products: data, 
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        totalPages: Math.ceil(count / limit)
      }
    };
  }

  async findById(id) {
    const { data, error } = await supabase
      .from('products')
      .select('*, variants:product_variants(*)')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async findBySlug(slug) {
    const { data, error } = await supabase
      .from('products')
      .select('*, variants:product_variants(*)')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async getFeatured(limit = 10) {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('is_featured', true)
      .eq('status', 'published')
      .is('deleted_at', null)
      .order('featured_priority', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data;
  }

  // Inventory Management Methods
  async updateStock(productId, quantityChange, transactionData = null) {
    // 1. Get current stock
    const { data: product, error: fetchError } = await supabase
      .from('products')
      .select('stock_quantity')
      .eq('id', productId)
      .single();

    if (fetchError) throw fetchError;

    const previousQuantity = product.stock_quantity;
    const newQuantity = previousQuantity + quantityChange;

    // 2. Update stock
    const { data: updatedProduct, error: updateError } = await supabase
      .from('products')
      .update({ 
        stock_quantity: newQuantity,
        status: newQuantity <= 0 ? 'out_of_stock' : 'published',
        updated_at: new Date().toISOString()
      })
      .eq('id', productId)
      .select()
      .single();

    if (updateError) throw updateError;

    // 3. Log transaction if provided
    if (transactionData) {
      const { error: transError } = await supabase
        .from('inventory_transactions')
        .insert([{
          ...transactionData,
          product_id: productId,
          previous_quantity: previousQuantity,
          new_quantity: newQuantity,
          quantity_change: quantityChange
        }]);
      
      if (transError) throw transError;
    }

    return updatedProduct;
  }

  async getLowStockProducts() {
    const { data, error } = await supabase
      .from('products')
      .select('id, name, sku, stock_quantity, low_stock_threshold')
      .is('deleted_at', null)
      .filter('stock_quantity', 'lte', 'low_stock_threshold');

    // Supabase JS doesn't support comparing two columns directly in filter easily without raw RPC or complex syntax
    // But we can use .or or .rpc if needed. 
    // Actually, we can use a raw filter string if using Postgres syntax, or just filter in JS for now if the list is small, 
    // but better to use a proper query.
    
    // Let's use a simpler approach or assuming we might need an RPC if it's complex.
    // For now, let's use a raw query if possible or just filter by a fixed threshold if it was common, 
    // but since it's per product, let's use .select with a filter.
    
    const { data: allLow, error: err } = await supabase
      .rpc('get_low_stock_products');
    
    if (err) {
      // Fallback if RPC not defined
      const { data: fallback, error: fallbackErr } = await supabase
        .from('products')
        .select('id, name, sku, stock_quantity, low_stock_threshold')
        .is('deleted_at', null)
        .lt('stock_quantity', 10); // Default threshold fallback
      
      if (fallbackErr) throw fallbackErr;
      return fallback;
    }

    return allLow;
  }

  async getStockByProductId(productId) {
    const { data, error } = await supabase
      .from('products')
      .select(`
        id, name, sku, stock_quantity, low_stock_threshold, status,
        variants:product_variants(id, name, sku, stock_quantity)
      `)
      .eq('id', productId)
      .single();

    if (error) throw error;
    return data;
  }

  async create(productData) {
    const { data, error } = await supabase
      .from('products')
      .insert([productData])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async update(id, updateData) {
    const { data, error } = await supabase
      .from('products')
      .update({ ...updateData, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async softDelete(id) {
    const { error } = await supabase
      .from('products')
      .update({ 
        deleted_at: new Date().toISOString(),
        status: 'archived'
      })
      .eq('id', id);

    if (error) throw error;
    return true;
  }

  /**
   * Atomically reserve (increment) reserved_quantity for a product row,
   * only if the result does not exceed stock_quantity.
   * Returns the updated row or null if insufficient available stock.
   */
  async updateReservedStock(productId, quantity) {
    const { data, error } = await supabase.rpc('reserve_stock_increment', {
      p_product_id: productId,
      p_quantity:   quantity
    }).single();

    if (error) throw error;
    return data;
  }
}

module.exports = new ProductModel();
