// Fegex local courier adapter — extends the local adapter with Fegex's
// status vocabulary (status = 'PickedUp' | 'OnTheWay' | 'Delivered').
const local = require('./local.adapter');

const FEGEX_MAP = {
  pickedup: 'picked_up',
  ontheway: 'out_for_delivery',
  delivered: 'delivered',
  cancelled: 'cancelled'
};

function mapWebhook(payload) {
  const raw = (payload.status || '').toLowerCase().replace(/\s+/g, '');
  return {
    external_shipment_id: payload.shipmentId || payload.external_shipment_id,
    tracking_number: payload.trackingNumber || payload.tracking_number,
    label_url: payload.labelUrl || payload.label_url,
    status: FEGEX_MAP[raw] || 'in_transit',
    raw: payload
  };
}

module.exports = {
  createShipment: local.createShipment,
  verifyWebhook: local.verifyWebhook,
  mapWebhook
};
