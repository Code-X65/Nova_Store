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
    const topProducts = await AnalyticsModel.getBestSellers(from, to, 5, 'revenue');

    return {
      period,
      dateRange: { from, to },
      metrics,
      charts: {
        revenueOverTime,
        topProducts
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
    const products = await AnalyticsModel.getBestSellers(from, to, limit, sortBy, category);
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
