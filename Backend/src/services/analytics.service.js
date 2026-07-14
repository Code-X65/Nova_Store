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

  async getForecast(metric, from, to) {
    const { from: fFrom, to: fTo } = this.parseDateRange(from, to);

    // Seasonal naive forecast: average same-weekday values from past 4 weeks
    const endDate = new Date(fTo);
    const startDate = new Date(fFrom);
    const days = [];
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      days.push(new Date(d));
    }

    // Fetch historical daily data for the past 28 days before the forecast window
    const historyStart = new Date(startDate);
    historyStart.setDate(historyStart.getDate() - 28);
    const historyEnd = new Date(startDate);
    historyEnd.setDate(historyEnd.getDate() - 1);

    let history = [];
    try {
      const summary = await AnalyticsModel.getSalesSummary(historyStart.toISOString(), historyEnd.toISOString(), 'day');
      history = summary || [];
    } catch {
      history = [];
    }

    const byDate = new Map();
    for (const row of history) {
      const date = row.period ? row.period.substring(0, 10) : null;
      if (date) byDate.set(date, Number(row.revenue) || 0);
    }

    const getHistoricalValue = (date) => {
      const key = date.toISOString().substring(0, 10);
      return byDate.get(key) || 0;
    };

    const forecast = days.map((date) => {
      const dow = date.getDay();
      let values = [];
      for (let w = 1; w <= 4; w++) {
        const ref = new Date(date);
        ref.setDate(ref.getDate() - w * 7);
        values.push(getHistoricalValue(ref));
      }
      const forecastValue = values.reduce((a, b) => a + b, 0) / values.length;
      const confidenceLow = forecastValue * 0.8;
      const confidenceHigh = forecastValue * 1.2;

      return {
        period: date.toISOString().substring(0, 10),
        forecast_value: Math.max(0, forecastValue),
        confidence_low: Math.max(0, confidenceLow),
        confidence_high: Math.max(0, confidenceHigh),
      };
    });

    return { metric, forecast, generatedAt: new Date().toISOString() };
  }

  async saveForecast(metric, forecast) {
    const records = forecast.map((f) => ({
      metric,
      period_start: f.period,
      period_end: f.period,
      forecast_value: f.forecast_value,
      confidence_low: f.confidence_low,
      confidence_high: f.confidence_high,
      model_name: 'seasonal_naive',
      actual_value: null,
    }));

    const saved = [];
    for (const rec of records) {
      try {
        const row = await AnalyticsModel.saveForecast(rec);
        saved.push(row);
      } catch {
        // skip duplicate or failed inserts
      }
    }
    return saved;
  }

  async getCustomerHeatmap(productId, from, to) {
    const events = await AnalyticsModel.getCustomerHeatmap(productId, from, to);
    return events.map((e) => ({
      event_type: e.event_type,
      created_at: e.created_at,
      customer: e.customer ? `${e.customer.first_name} ${e.customer.last_name}` : 'Anonymous',
    }));
  }

  async getHeatmapSummary(from, to) {
    const events = await AnalyticsModel.getHeatmapSummary(from, to);
    return events.map((e) => ({
      event_type: e.event_type,
      product_id: e.product_id,
      product_name: e.product?.name,
      category_id: e.category_id,
      category_name: e.category?.name,
      created_at: e.created_at,
      customer: e.customer ? `${e.customer.first_name} ${e.customer.last_name}` : 'Anonymous',
    }));
  }
}

module.exports = new AnalyticsService();
