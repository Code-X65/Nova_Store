const RefundService = require('../../services/refund.service');
const OrderModel = require('../../models/order.model');
const { SINGLE_STORE_ID } = require('../../config/store');

class RefundController {
  async list(req, res, next) {
    try {
      const { status, orderId, page, limit } = req.query;
      const result = await RefundService.listRefunds({ status, orderId }, { page: page || 1, limit: limit || 20 });
      res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  async getForOrder(req, res, next) {
    try {
      const list = await RefundService.listForOrder(req.params.id);
      res.status(200).json({ success: true, data: { refunds: list } });
    } catch (err) {
      next(err);
    }
  }

  async create(req, res, next) {
    try {
      const { orderId, amount, reason, method, notes } = req.body;
      if (!orderId || amount == null) {
        return res.status(400).json({ success: false, message: 'orderId and amount are required' });
      }
      const refund = await RefundService.createRefund({
        orderId, amount, reason, method, notes, requestedBy: req.admin?.id || req.user?.id
      });
      res.status(201).json({ success: true, data: { refund }, message: 'Refund created (pending approval)' });
    } catch (err) {
      next(err);
    }
  }

  async process(req, res, next) {
    try {
      const refund = await RefundService.approveAndProcess(req.params.id, req.admin?.id || req.user?.id, req);
      res.status(200).json({ success: true, data: { refund }, message: 'Refund processed' });
    } catch (err) {
      if (err.statusCode === 502) {
        return res.status(502).json({ success: false, message: err.message });
      }
      next(err);
    }
  }

  async cancel(req, res, next) {
    try {
      const refund = await RefundService.cancelRefund(req.params.id, req.admin?.id || req.user?.id);
      res.status(200).json({ success: true, data: { refund }, message: 'Refund cancelled' });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new RefundController();
