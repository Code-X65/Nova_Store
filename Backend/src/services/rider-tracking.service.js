const RiderTrackingModel = require('../models/rider-tracking.model');
const OrderModel = require('../models/order.model');
const OrderService = require('./order.service');
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
   * Record proof-of-delivery with geofence + photo/signature pins, and drive
   * the order through the actual delivered transition — previously this only
   * wrote directly to delivery_dispatches with no status change, no
   * precondition check, no order sync, and no customer notification, as a
   * second delivery-completion path fully disconnected from
   * OrderService.markDelivered.
   */
  async recordPod(dispatchId, { podPhotoUrl, podSignatureUrl, lat, lng, geofenceEtaAt } = {}, actorId = null) {
    const patch = {};
    if (podPhotoUrl != null) patch.pod_photo_url = podPhotoUrl;
    if (podSignatureUrl != null) patch.pod_signature_url = podSignatureUrl;
    if (lat != null) patch.delivered_lat = lat;
    if (lng != null) patch.delivered_lng = lng;
    if (geofenceEtaAt != null) patch.geofence_eta_at = geofenceEtaAt;
    const dispatch = await RiderTrackingModel.recordPod(dispatchId, patch);

    if (dispatch?.order_id) {
      const order = await OrderModel.findById(dispatch.order_id);
      // Idempotent: if the order is already delivered (or further along),
      // don't re-run markDelivered's notifications/event-emit — the POD
      // fields above are still recorded either way.
      if (order && order.status !== 'delivered') {
        try {
          await OrderService.markDelivered(dispatch.order_id, {
            podType: podPhotoUrl ? 'photo' : (podSignatureUrl ? 'signature' : 'geofence'),
            podValue: podPhotoUrl || podSignatureUrl || null,
            note: 'Proof of delivery recorded via rider app'
          }, actorId);
        } catch (err) {
          logger.error(`[RiderTrackingService] Failed to sync order ${dispatch.order_id} to delivered after POD:`, err.message);
          throw err;
        }
      }
    }

    return dispatch;
  }
}

module.exports = new RiderTrackingService();
