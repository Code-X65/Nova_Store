const supabase = require('../config/supabase');

class AnalyticsModel {
  async getDashboardSummary(from, to) {
    // Basic sums
    const { data: salesData, error: salesError } = await supabase
      .from('orders')
      .select('total_amount, status')
      .gte('created_at', from)
      .lte('created_at', to);

    if (salesError) throw salesError;

    let totalSales = 0;
    let totalOrders = salesData.length;
    let pending = 0, shipped = 0, delivered = 0;

    salesData.forEach(o => {
      if (['delivered', 'shipped', 'processing'].includes(o.status)) {
        totalSales += Number(o.total_amount) || 0;
      }
      if (o.status === 'pending') pending++;
      if (o.status === 'shipped') shipped++;
      if (o.status === 'delivered') delivered++;
    });

    const averageOrderValue = totalOrders > 0 ? (totalSales / totalOrders) : 0;

    // Users
    const { count: totalCustomers, error: usersError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    if (usersError) throw usersError;

    const { count: newCustomers, error: newUsersError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', from)
      .lte('created_at', to);

    if (newUsersError) throw newUsersError;

    return {
      totalSales,
      totalOrders,
      averageOrderValue,
      totalCustomers,
      newCustomersThisPeriod: newCustomers,
      ordersPending: pending,
      ordersShipped: shipped,
      ordersDelivered: delivered
    };
  }

  async getSalesSummary(from, to, groupBy) {
    const { data, error } = await supabase.rpc('get_sales_summary', {
      start_date: from,
      end_date: to,
      group_period: groupBy
    });

    if (error) throw error;
    return data;
  }

  async getSalesByCategory(from, to) {
    const { data, error } = await supabase.rpc('get_sales_by_category', {
      start_date: from,
      end_date: to
    });

    if (error) throw error;
    return data;
  }

  async getBestSellers(from, to, limit, sortBy, categoryId) {
    const { data, error } = await supabase.rpc('get_best_sellers', {
      start_date: from,
      end_date: to,
      top_limit: limit,
      sort_by: sortBy,
      cat_id: categoryId || null
    });

    if (error) throw error;
    return data;
  }

  async getUserGrowth(from, to, groupBy) {
    const { data, error } = await supabase.rpc('get_user_growth', {
      start_date: from,
      end_date: to,
      group_period: groupBy
    });

    if (error) throw error;
    return data;
  }

  async getOrderStatusBreakdown(from, to) {
    // Simple count by status
    const { data, error } = await supabase
      .from('orders')
      .select('status')
      .gte('created_at', from)
      .lte('created_at', to);

    if (error) throw error;

    const breakdown = {};
    data.forEach(o => {
      breakdown[o.status] = (breakdown[o.status] || 0) + 1;
    });

    return breakdown;
  }

  async getPaymentProviderStats(from, to) {
    const { data, error } = await supabase
      .from('payments')
      .select('provider, status, amount')
      .gte('created_at', from)
      .lte('created_at', to);

    if (error) throw error;

    const stats = {};
    let totalSuccess = 0;
    let totalCount = data.length;

    data.forEach(p => {
      if (!stats[p.provider]) {
        stats[p.provider] = { provider: p.provider, successCount: 0, failedCount: 0, totalAmount: 0 };
      }
      if (p.status === 'completed' || p.status === 'successful') {
        stats[p.provider].successCount++;
        stats[p.provider].totalAmount += Number(p.amount) || 0;
        totalSuccess++;
      } else {
        stats[p.provider].failedCount++;
      }
    });

    return {
      byProvider: Object.values(stats),
      successRate: totalCount > 0 ? (totalSuccess / totalCount) * 100 : 0
    };
  }

  async getInventoryAlerts(limit) {
    const { data, error } = await supabase
      .from('products')
      .select('id, name, stock_quantity, low_stock_threshold')
      .order('stock_quantity', { ascending: true })
      .limit(limit);

    if (error) throw error;

    return {
      lowStockProducts: data.filter(p => p.stock_quantity > 0 && p.stock_quantity <= (p.low_stock_threshold || 10)),
      outOfStockProducts: data.filter(p => p.stock_quantity === 0)
    };
  }

  async getForecast(metric, from, to) {
    const { data, error } = await supabase
      .from('forecast_snapshots')
      .select('*')
      .eq('metric', metric)
      .gte('period_start', from)
      .lte('period_end', to)
      .order('period_start', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async saveForecast(forecast) {
    const { data, error } = await supabase
      .from('forecast_snapshots')
      .insert([forecast])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getCustomerHeatmap(productId, from, to) {
    const { data, error } = await supabase
      .from('customer_events')
      .select('event_type, created_at, product_id, category_id, customer:users!customer_id(id,first_name,last_name,email)')
      .eq('product_id', productId)
      .gte('created_at', from)
      .lte('created_at', to)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async getHeatmapSummary(from, to) {
    const { data, error } = await supabase
      .from('customer_events')
      .select('event_type, product_id, category_id, created_at, product:products!product_id(name,primary_image_url), category:product_categories!category_id(name)')
      .gte('created_at', from)
      .lte('created_at', to)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  }
}

module.exports = new AnalyticsModel();
