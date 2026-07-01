const supabase               = require('../config/supabase');
const { supabaseAdmin }      = require('../config/supabase');
const productAttributeModel  = require('./product-attribute.model');

class ProductModel {
  async findAll(filters = {}, pagination = { page: 1, limit: 20 }) {
    const { page, limit } = pagination;
    const offset = (page - 1) * limit;
    const { attrFilters, ...stdFilters } = filters;

    // --- Attribute-filtered path: use RPC ---
    if (attrFilters && Object.keys(attrFilters).length > 0) {
      const supabaseClient = supabaseAdmin || supabase;
      const { data, error } = await supabaseClient.rpc(
        'get_products_by_attributes',
        { attr_filters: attrFilters }
      );
      if (error) throw error;

      // Apply standard filters in-memory (RPC returns all matching attribute rows)
      let results = data || [];
      if (stdFilters.status)      results = results.filter(p => p.status === stdFilters.status);
      if (stdFilters.category_id) results = results.filter(p => p.category_id === stdFilters.category_id);
      if (stdFilters.brand_id)    results = results.filter(p => p.brand_id === stdFilters.brand_id);
      if (stdFilters.subcategory_id) results = results.filter(p => p.subcategory_id === stdFilters.subcategory_id);
      if (stdFilters.is_featured !== undefined) results = results.filter(p => p.is_featured === stdFilters.is_featured);
      if (stdFilters.minPrice)    results = results.filter(p => p.price >= stdFilters.minPrice);
      if (stdFilters.maxPrice)    results = results.filter(p => p.price <= stdFilters.maxPrice);
      if (stdFilters.search) {
        const q = stdFilters.search.toLowerCase();
        results = results.filter(p =>
          (p.name || '').toLowerCase().includes(q) ||
          (p.description || '').toLowerCase().includes(q) ||
          (p.sku || '').toLowerCase().includes(q)
        );
      }

      const total     = results.length;
      const paginated = results.slice(offset, offset + limit);
      return {
        products: paginated,
        pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / limit) }
      };
    }

    // --- Standard path ---
    let query = supabase
      .from('products')
      .select('*', { count: 'exact' })
      .is('deleted_at', null);

    // Apply Filters
    if (stdFilters.status)      query = query.eq('status', stdFilters.status);
    if (stdFilters.category_id) query = query.eq('category_id', stdFilters.category_id);
    if (stdFilters.brand_id)    query = query.eq('brand_id', stdFilters.brand_id);
    if (stdFilters.subcategory_id) query = query.eq('subcategory_id', stdFilters.subcategory_id);
    if (stdFilters.is_featured !== undefined) query = query.eq('is_featured', stdFilters.is_featured);
    
    // Price Filtering
    if (stdFilters.minPrice) query = query.gte('price', stdFilters.minPrice);
    if (stdFilters.maxPrice) query = query.lte('price', stdFilters.maxPrice);
    
    // Rating Filtering
    if (stdFilters.minRating) query = query.gte('average_rating', stdFilters.minRating);

    if (stdFilters.search) {
      query = query.or(`name.ilike.%${stdFilters.search}%,description.ilike.%${stdFilters.search}%,sku.ilike.%${stdFilters.search}%`);
    }

    // Sorting
    const sortMapping = {
      'newest':     { column: 'created_at',    ascending: false },
      'cheapest':   { column: 'price',         ascending: true  },
      'price_low':  { column: 'price',         ascending: true  },
      'price_high': { column: 'price',         ascending: false },
      'popular':    { column: 'review_count',  ascending: false },
      'rating':     { column: 'average_rating',ascending: false }
    };

    const sortConfig = sortMapping[stdFilters.sortBy] || { column: stdFilters.sortBy || 'created_at', ascending: stdFilters.order !== 'asc' };
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
    if (!data) return null;

    // Attach dynamic attributes
    data.attributes = await productAttributeModel.findByProductId(id);
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
    if (!data) return null;

    // Attach dynamic attributes
    data.attributes = await productAttributeModel.findByProductId(data.id);
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

    // 2. Update product stock
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

    // 3. Update variant stock if variant_id is provided
    let prevVarQty = 0;
    let newVarQty = 0;
    const variantId = transactionData?.variant_id;

    if (variantId) {
      const { data: variant, error: varFetchError } = await supabase
        .from('product_variants')
        .select('stock_quantity')
        .eq('id', variantId)
        .single();
      if (varFetchError) throw varFetchError;

      prevVarQty = variant.stock_quantity || 0;
      newVarQty = prevVarQty + quantityChange;

      const { error: varUpdateError } = await supabase
        .from('product_variants')
        .update({
          stock_quantity: newVarQty,
          updated_at: new Date().toISOString()
        })
        .eq('id', variantId);
      if (varUpdateError) throw varUpdateError;
    }

    // 4. Log transaction if provided
    if (transactionData) {
      const { error: transError } = await supabase
        .from('inventory_transactions')
        .insert([{
          ...transactionData,
          product_id: productId,
          previous_quantity: variantId ? prevVarQty : previousQuantity,
          new_quantity: variantId ? newVarQty : newQuantity,
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

  async search(query, limit = 10) {
    const { data, error } = await supabase.rpc('search_products', {
      search_query: query,
      lim: limit
    });
    if (error) throw error;
    return data || [];
  }

  async getPriceRange(filters = {}) {
    let query = supabase
      .from('products')
      .select('price')
      .is('deleted_at', null);

    if (filters.status)      query = query.eq('status', filters.status);
    if (filters.category_id) query = query.eq('category_id', filters.category_id);
    if (filters.brand_id)    query = query.eq('brand_id', filters.brand_id);
    if (filters.subcategory_id) query = query.eq('subcategory_id', filters.subcategory_id);
    if (filters.is_featured !== undefined) query = query.eq('is_featured', filters.is_featured);

    if (filters.search) {
      query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%,sku.ilike.%${filters.search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    if (!data || data.length === 0) {
      return { minPrice: 0, maxPrice: 0 };
    }

    const prices = data.map(p => parseFloat(p.price));
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);

    return { minPrice, maxPrice };
  }
}

module.exports = new ProductModel();
