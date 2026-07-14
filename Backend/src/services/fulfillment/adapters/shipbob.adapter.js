// ShipBob 3PL adapter — extends the local adapter with ShipBob's
// webhook envelope (event.type / resources.shipment.object_id).
const local = require('./local.adapter');

function mapWebhook(payload) {
  const evt = payload.event || {};
  const shipment = payload.resources && payload.resources.shipment ? payload.resources.shipment : {};
  return {
    external_shipment_id: shipment.object_id || shipment.id || payload.shipment_id,
    tracking_number: shipment.tracking_number || payload.tracking_number,
    label_url: shipment.label_url || payload.label_url,
    status: local.mapWebhook({ status: evt.type || payload.status }).status,
    raw: payload
  };
}

module.exports = {
  createShipment: local.createShipment,
  verifyWebhook: local.verifyWebhook,
  mapWebhook
};
