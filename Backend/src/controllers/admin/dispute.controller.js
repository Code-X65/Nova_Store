const DisputeService = require('../../services/dispute.service');

class DisputeController {
  async list(req, res, next) {
    try {
      const { status, priority, breaching, page, limit } = req.query;
      const result = await DisputeService.listDisputes(
        { status, priority, breaching: breaching === 'true' },
        { page: page || 1, limit: limit || 20 }
      );
      res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  async create(req, res, next) {
    try {
      const { orderId, subject, description, priority, assignedTo, slaDueAt } = req.body;
      if (!orderId || !subject) {
        return res.status(400).json({ success: false, message: 'orderId and subject are required' });
      }
      const dispute = await DisputeService.createDispute({
        orderId, subject, description, priority, assignedTo, slaDueAt, openedBy: req.admin?.id || req.user?.id
      });
      res.status(201).json({ success: true, data: { dispute }, message: 'Dispute opened' });
    } catch (err) {
      next(err);
    }
  }

  async assign(req, res, next) {
    try {
      const { assignedTo } = req.body;
      const dispute = await DisputeService.assign(req.params.id, assignedTo, req);
      res.status(200).json({ success: true, data: { dispute } });
    } catch (err) {
      next(err);
    }
  }

  async escalate(req, res, next) {
    try {
      const dispute = await DisputeService.escalate(req.params.id, req);
      res.status(200).json({ success: true, data: { dispute } });
    } catch (err) {
      next(err);
    }
  }

  async resolve(req, res, next) {
    try {
      const { resolution, resolutionNotes, status } = req.body;
      const dispute = await DisputeService.resolve(req.params.id, { resolution, resolutionNotes, status }, req);
      res.status(200).json({ success: true, data: { dispute }, message: 'Dispute resolved' });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new DisputeController();
