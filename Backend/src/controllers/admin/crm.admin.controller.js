const CrmService = require('../../services/crm.service');

class CrmAdminController {
  async listSegments(req, res, next) {
    try {
      const { page, limit, is_active, search } = req.query;
      const result = await CrmService.listSegments({ is_active, search }, { page: page || 1, limit: limit || 20 });
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  async getSegment(req, res, next) {
    try {
      const segment = await CrmService.getSegment(req.params.id);
      res.status(200).json({ success: true, data: segment });
    } catch (error) {
      next(error);
    }
  }

  async createSegment(req, res, next) {
    try {
      const segment = await CrmService.createSegment(req.body, req);
      res.status(201).json({ success: true, data: segment, message: 'Segment created' });
    } catch (error) {
      next(error);
    }
  }

  async updateSegment(req, res, next) {
    try {
      const segment = await CrmService.updateSegment(req.params.id, req.body, req);
      res.status(200).json({ success: true, data: segment, message: 'Segment updated' });
    } catch (error) {
      next(error);
    }
  }

  async deleteSegment(req, res, next) {
    try {
      await CrmService.deleteSegment(req.params.id, req);
      res.status(200).json({ success: true, message: 'Segment deleted' });
    } catch (error) {
      next(error);
    }
  }

  async listCustomerEvents(req, res, next) {
    try {
      const { page, limit, customer_id, event_type, fromDate, toDate } = req.query;
      const result = await CrmService.listCustomerEvents({ customer_id, event_type, fromDate, toDate }, { page: page || 1, limit: limit || 50 });
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  async getProductHeatmap(req, res, next) {
    try {
      const { from, to } = req.query;
      const events = await CrmService.getProductHeatmap(req.params.productId, from, to);
      res.status(200).json({ success: true, data: events });
    } catch (error) {
      next(error);
    }
  }

  async getTopViewedProducts(req, res, next) {
    try {
      const { from, to, limit } = req.query;
      const products = await CrmService.getTopViewedProducts(from, to, limit || 10);
      res.status(200).json({ success: true, data: products });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new CrmAdminController();
