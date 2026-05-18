const supabase = require('../config/supabase');

class ProductReviewModel {
  async findByProductId(productId, filters = {}, pagination = { page: 1, limit: 20 }) {
    let query = supabase
      .from('product_reviews')
      .select('*, user:users(id, first_name, last_name, avatar_url)', { count: 'exact' })
      .eq('product_id', productId);

    if (filters.status) query = query.eq('status', filters.status);
    if (filters.rating) query = query.eq('rating', filters.rating);
    if (filters.isVerifiedPurchase !== undefined) query = query.eq('is_verified_purchase', filters.isVerifiedPurchase);

    if (filters.sortBy) {
      if (filters.sortBy === 'newest') query = query.order('created_at', { ascending: false });
      if (filters.sortBy === 'helpful') query = query.order('helpful_count', { ascending: false });
      if (filters.sortBy === 'highest') query = query.order('rating', { ascending: false });
      if (filters.sortBy === 'lowest') query = query.order('rating', { ascending: true });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    const { page, limit } = pagination;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, count, error } = await query.range(from, to);
    if (error) throw error;

    return { data, count, page, limit };
  }

  async findById(id) {
    const { data, error } = await supabase
      .from('product_reviews')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async findByUserAndProduct(userId, productId) {
    const { data, error } = await supabase
      .from('product_reviews')
      .select('*')
      .eq('user_id', userId)
      .eq('product_id', productId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async create(reviewData) {
    const { data, error } = await supabase
      .from('product_reviews')
      .insert([reviewData])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async update(id, reviewData) {
    reviewData.updated_at = new Date().toISOString();
    const { data, error } = await supabase
      .from('product_reviews')
      .update(reviewData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async delete(id) {
    const { error } = await supabase
      .from('product_reviews')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  }

  async getRatingDistribution(productId) {
    // Custom query might be needed for group by, but we can fetch all and count
    // or use a view/rpc. If using JS:
    const { data, error } = await supabase
      .from('product_reviews')
      .select('rating')
      .eq('product_id', productId)
      .eq('status', 'approved');

    if (error) throw error;

    const distribution = { "5": 0, "4": 0, "3": 0, "2": 0, "1": 0 };
    let sum = 0;
    
    data.forEach(r => {
      if (distribution[r.rating] !== undefined) {
        distribution[r.rating]++;
        sum += r.rating;
      }
    });

    const averageRating = data.length > 0 ? (sum / data.length).toFixed(1) : 0;

    return {
      reviewCount: data.length,
      averageRating: parseFloat(averageRating),
      ratingDistribution: distribution
    };
  }

  // Admin
  async findAll(filters = {}, pagination = { page: 1, limit: 20 }) {
    let query = supabase
      .from('product_reviews')
      .select('*, product:products(id, name), user:users(id, first_name, last_name, email)', { count: 'exact' });

    if (filters.status) query = query.eq('status', filters.status);
    if (filters.productId) query = query.eq('product_id', filters.productId);
    if (filters.userId) query = query.eq('user_id', filters.userId);

    const { page, limit } = pagination;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, count, error } = await query.order('created_at', { ascending: false }).range(from, to);
    if (error) throw error;

    return { data, count, page, limit };
  }
}

module.exports = new ProductReviewModel();
