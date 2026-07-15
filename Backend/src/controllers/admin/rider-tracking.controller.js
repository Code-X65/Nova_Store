const RiderTrackingService = require('../../services/rider-tracking.service');

class RiderTrackingController {
  async ping(req, res, next) {
    try {
      const { orderId, lat, lng, heading, speed, accuracyM, capturedAt } = req.body;
      const ping = await RiderTrackingService.recordPing({
        riderId: req.params.id, orderId, lat, lng, heading, speed, accuracyM, capturedAt
      });
      res.status(201).json({ success: true, data: { ping } });
    } catch (err) {
      next(err);
    }
  }

  async latest(req, res, next) {
    try {
      const ping = await RiderTrackingService.getLatest(req.params.id);
      res.status(200).json({ success: true, data: { location: ping } });
    } catch (err) {
      next(err);
    }
  }

  async route(req, res, next) {
    try {
      const { page, limit } = req.query;
      const result = await RiderTrackingService.getRoute(req.params.id, { page: page || 1, limit: limit || 100 });
      res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  async recordPod(req, res, next) {
    try {
      const { podPhotoUrl, podSignatureUrl, lat, lng, geofenceEtaAt } = req.body;
      const actorId = req.admin?.id || req.user?.id || null;
      const dispatch = await RiderTrackingService.recordPod(req.params.id, {
        podPhotoUrl, podSignatureUrl, lat, lng, geofenceEtaAt
      }, actorId);
      res.status(200).json({ success: true, data: { dispatch }, message: 'Proof of delivery recorded' });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new RiderTrackingController();
