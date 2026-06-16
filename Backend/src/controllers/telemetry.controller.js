const TelemetryService = require('../services/telemetry.service');

class TelemetryController {
  async trackSearch(req, res, next) {
    try {
      const { search_query } = req.body;
      const userId = req.user ? req.user.id : null;

      await TelemetryService.trackSearch(userId, search_query);
      
      res.status(202).json({
        success: true,
        message: 'Search query tracked successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  async trackView(req, res, next) {
    try {
      const { product_id, view_duration } = req.body;
      const userId = req.user ? req.user.id : null;

      await TelemetryService.trackView(userId, product_id, view_duration);

      res.status(202).json({
        success: true,
        message: 'Product view tracked successfully'
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new TelemetryController();
