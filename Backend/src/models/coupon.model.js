const supabase = require('../config/supabase');

class CouponModel {
  async findByCode(code) {
    const { data, error } = await supabase
      .from('coupons')
      .select('*')
      .eq('code', code.toUpperCase())
      .eq('is_active', true)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async incrementUsage(id) {
    const { data, error } = await supabase.rpc('increment_coupon_usage', { coupon_id: id });
    if (error) throw error;
    return data;
  }

  /**
   * Atomically claim a usage slot (global + per-customer) for an order at
   * order-creation time. Returns true if claimed, false if a limit was hit.
   */
  async claimUsage(couponId, userId, orderId) {
    const { data, error } = await supabase.rpc('claim_coupon_usage', {
      p_coupon_id: couponId,
      p_user_id: userId,
      p_order_id: orderId
    });
    if (error) throw error;
    return data === true;
  }

  /** Release a claimed-but-never-paid usage (order cancelled or payment failed). */
  async releaseUsage(couponId, orderId) {
    const { error } = await supabase.rpc('release_coupon_usage', { p_coupon_id: couponId, p_order_id: orderId });
    if (error) throw error;
  }

  /** Confirm a claimed usage on payment success. */
  async confirmUsage(couponId, orderId, userId) {
    const { error } = await supabase.rpc('confirm_coupon_usage', {
      p_coupon_id: couponId,
      p_order_id: orderId,
      p_user_id: userId
    });
    if (error) throw error;
  }

  async checkUserUsage(userId, couponId) {
    const { data, error } = await supabase
      .from('user_coupons')
      .select('id')
      .eq('user_id', userId)
      .eq('coupon_id', couponId)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async logUserUsage(userId, couponId, orderId = null) {
    const { data, error } = await supabase
      .from('user_coupons')
      .insert([{ user_id: userId, coupon_id: couponId, order_id: orderId, used_at: new Date().toISOString() }])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async findAll(filters = {}, pagination = { page: 1, limit: 10 }) {
    let query = supabase.from('coupons').select('*', { count: 'exact' });

    if (filters.isActive !== undefined) query = query.eq('is_active', filters.isActive);
    if (filters.code) query = query.ilike('code', `%${filters.code}%`);
    if (filters.type) query = query.eq('type', filters.type);

    const { page, limit } = pagination;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;
    return { data, count, page, limit };
  }

  async findAvailableForUser(userId) {
    // Basic query to fetch active coupons
    // Complex validation (per customer limit) can be handled in service or via the RPC function
    const { data, error } = await supabase
      .from('coupons')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  async findUserHistory(userId) {
    const { data, error } = await supabase
      .from('user_coupons')
      .select('*, coupon:coupons(*)')
      .eq('user_id', userId)
      .order('used_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  async create(couponData) {
    if (couponData.code) couponData.code = couponData.code.toUpperCase();
    const { data, error } = await supabase
      .from('coupons')
      .insert([couponData])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async update(id, updateData) {
    if (updateData.code) updateData.code = updateData.code.toUpperCase();
    
    const { data, error } = await supabase
      .from('coupons')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async delete(id) {
    const { error } = await supabase
      .from('coupons')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  }

  async deactivate(id) {
    return await this.update(id, { is_active: false });
  }

  async findById(id) {
    const { data, error } = await supabase
      .from('coupons')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async getUsageAnalytics(id) {
    const { data: coupon, error: couponError } = await supabase
      .from('coupons')
      .select('*')
      .eq('id', id)
      .single();

    if (couponError) throw couponError;

    const { data: usages, error: usageError } = await supabase
      .from('user_coupons')
      .select('user_id, used_at', { count: 'exact' })
      .eq('coupon_id', id);

    if (usageError) throw usageError;

    const uniqueUsers = new Set(usages.map(u => u.user_id)).size;

    return {
      coupon,
      totalUsed: usages.length,
      uniqueUsers,
      recentUsage: usages.slice(0, 50) // Return last 50
    };
  }
}

module.exports = new CouponModel();
