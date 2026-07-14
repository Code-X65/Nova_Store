const RiderTrackingModel = require('../models/rider-tracking.model');
const logger = require('../utils/logger');

/**
 * Rider live tracking & proof-of-delivery (Phase 5 §7.2)
 */
class RiderTrackingService {
  async recordPing({ riderId, orderId, lat, lng, heading, speed, accuracyM, capturedAt } = {}) {
    if (lat == null || lng == null) throw new Error('lat and lng are required');
    return await RiderTrackingModel.createPing({
      rider_id: riderId,
      order_id: orderId || null,
      lat,
      lng,
      heading: heading ?? null,
      speed: speed ?? null,
      accuracy_m: accuracyM ?? null,
      captured_at: capturedAt || new Date().toISOString()
    });
  }

  async getLatest(riderId) {
    return await RiderTrackingModel.latestPing(riderId);
  }

  async getRoute(orderId, pagination = { page: 1, limit: 100 }) {
    return await RiderTrackingModel.listPings({ orderId }, pagination);
  }

  /**
   * Record proof-of-delivery with geofence + photo/signature pins.
   */
  async recordPod(dispatchId, { podPhotoUrl, podSignatureUrl, lat, lng, geofenceEtaAt } = {}) {
    const patch = {};
    if (podPhotoUrl != null) patch.pod_photo_url = podPhotoUrl;
    if (podSignatureUrl != null) patch.pod_signature_url = podSignatureUrl;
    if (lat != null) patch.delivered_lat = lat;
    if (lng != null) patch.delivered_lng = lng;
    if (geofenceEtaAt != null) patch.geofence_eta_at = geofenceEtaAt;
    return await RiderTrackingModel.recordPod(dispatchId, patch);
  }
}

module.exports = new RiderTrackingService();
