const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Local / generic fulfillment adapter.
 *
 * Produces a printable shipment label (plain text for the local
 * carrier) and parses inbound webhooks. Other adapters (shipbob,
 * fegex) extend/override the webhook mapping to match their payload
 * shapes while reusing this label generation.
 */
function generateTrackingNumber() {
  return `LOC${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
}

async function createShipment(order, provider, payload, { fs, LABEL_DIR }) {
  const trackingNumber = payload.tracking_number || generateTrackingNumber();
  const externalId = payload.external_shipment_id || `loc_${crypto.randomBytes(8).toString('hex')}`;

  fs.mkdirSync(LABEL_DIR, { recursive: true });
  const labelName = `label-${externalId}.txt`;
  const labelContent = [
    'NOVA STORE — SHIPMENT LABEL',
    '---------------------------',
    `Order:        ${order.order_number}`,
    `Carrier:      ${provider.name}`,
    `Tracking:     ${trackingNumber}`,
    `Recipient:    ${order.customer_email || ''}`,
    `Generated:    ${new Date().toISOString()}`
  ].join('\n');
  fs.writeFileSync(path.join(LABEL_DIR, labelName), labelContent);

  return {
    external_shipment_id: externalId,
    tracking_number: trackingNumber,
    label_url: `/uploads/fulfillment/${labelName}`,
    status: 'label_generated',
    raw: { provider: provider.code, generatedLocally: true }
  };
}

function verifyWebhook(rawBody, signature, secret) {
  if (!secret) return true; // local provider: trust unauthenticated pings
  const bodyStr = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody);
  const expected = crypto.createHmac('sha256', secret).update(bodyStr).digest('hex');
  const provided = String(signature || '').replace(/^sha256=/, '');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
  } catch {
    return false;
  }
}

/**
 * Map a provider webhook payload to a canonical status update.
 * Override per provider as needed.
 */
function mapWebhook(payload) {
  const statusMap = {
    label_created: 'label_generated',
    picked: 'picked_up',
    in_transit: 'in_transit',
    out_for_delivery: 'out_for_delivery',
    delivered: 'delivered',
    exception: 'exception',
    cancelled: 'cancelled'
  };
  const rawStatus = (payload.status || payload.event || '').toLowerCase();
  return {
    external_shipment_id: payload.shipment_id || payload.external_shipment_id,
    tracking_number: payload.tracking_number || payload.trackingNumber,
    label_url: payload.label_url,
    status: statusMap[rawStatus] || 'in_transit',
    raw: payload
  };
}

module.exports = { createShipment, verifyWebhook, mapWebhook };
