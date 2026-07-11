const AnalyticsModel = require('../models/analytics.model');

class AnalyticsService {
  parseDateRange(from, to) {
    // Default: last 30 days
    const toDate = to ? new Date(to) : new Date();
    const fromDate = from ? new Date(from) : new Date();
    
    if (!from) {
      fromDate.setDate(toDate.getDate() - 30);
    }
    
    // Set boundaries: from 00:00:00 to 23:59:59
    fromDate.setUTCHours(0, 0, 0, 0);
    toDate.setUTCHours(23, 59, 59, 999);

    return { 
      from: fromDate.toISOString(), 
      to: toDate.toISOString() 
    };
  }

  async getDashboard(fromParam, toParam, period = 'day') {
    const { from, to } = this.parseDateRange(fromParam, toParam);
    
    const metrics = await AnalyticsModel.getDashboardSummary(from, to);
    const revenueOverTime = await AnalyticsModel.getSalesSummary(from, to, period);
    
    // Top products mapping
    const rawTopProducts = await AnalyticsModel.getBestSellers(from, to, 5, 'revenue');
    const topProducts = rawTopProducts.map(p => ({
      id: p.product_id,
      name: p.product_name,
      primary_image_url: p.primary_image_url,
      thumbnail_url: p.thumbnail_url,
      category: { name: p.category_name },
      quantity_sold: Number(p.quantity_sold),
      revenue: Number(p.revenue),
      stock_quantity: p.stock_quantity
    }));

    // Sales by Category mapping
    const rawSalesByCategory = await AnalyticsModel.getSalesByCategory(from, to);
    const totalCatRevenue = rawSalesByCategory.reduce((sum, c) => sum + Number(c.revenue), 0);
    const colors = ['#FF6A1C', '#FF8C4C', '#FFAD7D', '#FFCEAD', '#FFF0E6', '#F3F4F6', '#E5E7EB'];
    const salesByCategory = rawSalesByCategory.map((c, i) => ({
      name: c.category_name,
      value: Number(c.revenue),
      percentage: totalCatRevenue > 0 ? Math.round((Number(c.revenue) / totalCatRevenue) * 100) : 0,
      color: colors[i % colors.length]
    }));

    return {
      period,
      dateRange: { from, to },
      metrics,
      charts: {
        revenueOverTime,
        topProducts,
        salesByCategory
      }
    };
  }

  async getRevenue(fromParam, toParam, groupBy = 'day') {
    const { from, to } = this.parseDateRange(fromParam, toParam);
    const data = await AnalyticsModel.getSalesSummary(from, to, groupBy);
    
    let totalRev = 0, totalOrders = 0;
    data.forEach(d => {
      totalRev += Number(d.revenue);
      totalOrders += Number(d.orders);
    });

    return {
      groupBy,
      data,
      totals: { revenue: totalRev, orders: totalOrders }
    };
  }

  async getRevenueSummary(fromParam, toParam) {
    const { from, to } = this.parseDateRange(fromParam, toParam);
    const metrics = await AnalyticsModel.getDashboardSummary(from, to);
    
    return {
      from, to,
      totalRevenue: metrics.totalSales,
      totalOrders: metrics.totalOrders,
      averageOrderValue: metrics.averageOrderValue
    };
  }

  async getBestSellers(fromParam, toParam, limit = 10, sortBy = 'quantity', category = null) {
    const { from, to } = this.parseDateRange(fromParam, toParam);
    const rawProducts = await AnalyticsModel.getBestSellers(from, to, limit, sortBy, category);
    
    const products = rawProducts.map(p => ({
      id: p.product_id,
      name: p.product_name,
      primary_image_url: p.primary_image_url,
      thumbnail_url: p.thumbnail_url,
      category: { name: p.category_name },
      quantity_sold: Number(p.quantity_sold),
      revenue: Number(p.revenue),
      stock_quantity: p.stock_quantity
    }));

    return { products };
  }

  async getUsersReport(fromParam, toParam, groupBy = 'day') {
    const { from, to } = this.parseDateRange(fromParam, toParam);
    const growthData = await AnalyticsModel.getUserGrowth(from, to, groupBy);
    
    const summary = await AnalyticsModel.getDashboardSummary(from, to);

    // Calculate cumulative (simplified logic, true cumulative needs full history)
    let cumulative = summary.totalCustomers - summary.newCustomersThisPeriod;
    growthData.forEach(d => {
      cumulative += Number(d.new_users);
      d.cumulativeUsers = cumulative;
    });

    return {
      growthData,
      totals: {
        newUsersThisPeriod: summary.newCustomersThisPeriod,
        totalUsers: summary.totalCustomers
      }
    };
  }

  async getOrdersReport(fromParam, toParam, groupBy = 'day') {
    const { from, to } = this.parseDateRange(fromParam, toParam);
    
    const ordersOverTime = await AnalyticsModel.getSalesSummary(from, to, groupBy);
    const statusBreakdown = await AnalyticsModel.getOrderStatusBreakdown(from, to);
    const summary = await AnalyticsModel.getDashboardSummary(from, to);

    return {
      ordersOverTime: ordersOverTime.map(o => ({ period: o.period, count: o.orders })),
      statusBreakdown,
      averageOrderValue: summary.averageOrderValue
    };
  }

  async getPaymentsAnalytics(fromParam, toParam) {
    const { from, to } = this.parseDateRange(fromParam, toParam);
    return await AnalyticsModel.getPaymentProviderStats(from, to);
  }

  async getInventoryAnalytics(limit = 10) {
    // Stock alerts ignore date ranges
    return await AnalyticsModel.getInventoryAlerts(limit);
  }
}

module.exports = new AnalyticsService();
