const AnalyticsService = require('../../services/analytics.service');
const reportExporter = require('../../utils/report-exporter');

exports.getDashboard = async (req, res, next) => {
  try {
    const { from, to, period } = req.query;
    const data = await AnalyticsService.getDashboard(from, to, period);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

exports.getRevenue = async (req, res, next) => {
  try {
    const { from, to, groupBy } = req.query;
    const data = await AnalyticsService.getRevenue(from, to, groupBy);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

exports.getRevenueSummary = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const data = await AnalyticsService.getRevenueSummary(from, to);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

exports.getBestSellers = async (req, res, next) => {
  try {
    const { from, to, limit, sortBy, category } = req.query;
    const data = await AnalyticsService.getBestSellers(from, to, limit, sortBy, category);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

exports.getUsers = async (req, res, next) => {
  try {
    const { from, to, groupBy } = req.query;
    const data = await AnalyticsService.getUsersReport(from, to, groupBy);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

exports.getOrders = async (req, res, next) => {
  try {
    const { from, to, groupBy } = req.query;
    const data = await AnalyticsService.getOrdersReport(from, to, groupBy);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

exports.getPayments = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const data = await AnalyticsService.getPaymentsAnalytics(from, to);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

exports.getInventory = async (req, res, next) => {
  try {
    const { limit } = req.query;
    const data = await AnalyticsService.getInventoryAnalytics(limit);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

exports.exportRevenue = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const data = await AnalyticsService.getRevenue(from, to, 'day');
    
    const csv = reportExporter.toCSV(data.data);
    res.header('Content-Type', 'text/csv');
    res.attachment(`revenue-export-${new Date().toISOString().split('T')[0]}.csv`);
    return res.send(csv);
  } catch (error) {
    next(error);
  }
};

exports.getForecast = async (req, res, next) => {
  try {
    const { metric, from, to } = req.query;
    const data = await AnalyticsService.getForecast(metric || 'revenue', from, to);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

exports.saveForecast = async (req, res, next) => {
  try {
    const { metric, forecast } = req.body;
    const data = await AnalyticsService.saveForecast(metric || 'revenue', forecast);
    res.status(201).json({ success: true, data, message: 'Forecast saved' });
  } catch (error) {
    next(error);
  }
};

exports.getCustomerHeatmap = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const { from, to } = req.query;
    const data = await AnalyticsService.getCustomerHeatmap(productId, from, to);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

exports.getHeatmapSummary = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const data = await AnalyticsService.getHeatmapSummary(from, to);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};
