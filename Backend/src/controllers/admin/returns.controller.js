const ReturnsService = require('../../services/returns.service');

class ReturnsController {
  async list(req, res, next) {
    try {
      const { status, orderId, page, limit } = req.query;
      const result = await ReturnsService.listReturns({ status, orderId }, { page: page || 1, limit: limit || 20 });
      res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  async getForOrder(req, res, next) {
    try {
      const list = await ReturnsService.listForOrder(req.params.id);
      res.status(200).json({ success: true, data: { returns: list } });
    } catch (err) {
      next(err);
    }
  }

  async create(req, res, next) {
    try {
      const { orderId, reason, condition, returnMethod, refundAmount } = req.body;
      if (!orderId) return res.status(400).json({ success: false, message: 'orderId is required' });
      const rma = await ReturnsService.createRma({
        orderId, reason, condition, returnMethod, refundAmount, createdBy: req.admin?.id || req.user?.id
      });
      res.status(201).json({ success: true, data: { rma }, message: 'RMA opened' });
    } catch (err) {
      next(err);
    }
  }

  async transition(req, res, next) {
    try {
      const { action, note, condition, qcOutcome, refundAmount } = req.body;
      const rma = await ReturnsService.transition(
        req.params.id, action,
        { note, condition, qcOutcome, refundAmount, adminId: req.admin?.id || req.user?.id, req }
      );
      res.status(200).json({ success: true, data: { rma }, message: `RMA ${action} complete` });
    } catch (err) {
      next(err);
    }
  }

  async generateLabel(req, res, next) {
    try {
      const { carrier, trackingNumber } = req.body;
      const label = await ReturnsService.generateLabel(req.params.id, { carrier, trackingNumber });
      res.status(201).json({ success: true, data: { label }, message: 'Return label generated' });
    } catch (err) {
      next(err);
    }
  }

  async listLabels(req, res, next) {
    try {
      const labels = await ReturnsService.listLabels(req.params.id);
      res.status(200).json({ success: true, data: { labels } });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ReturnsController();
