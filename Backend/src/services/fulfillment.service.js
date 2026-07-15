const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const FulfillmentModel = require('../models/fulfillment.model');
const OrderModel = require('../models/order.model');
const OrderService = require('./order.service');
const OrderStateMachine = require('./order-state-machine.service');
const logger = require('../utils/logger');
const { SINGLE_STORE_ID } = require('../config/store');

const ADAPTER_DIR = path.join(__dirname, 'fulfillment', 'adapters');
const LABEL_DIR = path.join(__dirname, '../../uploads/fulfillment');

/**
 * Adapter registry. Each provider `adapter` column maps to
 * services/fulfillment/adapters/<name>.adapter.js. Falls back to the
 * local adapter when a provider-specific adapter is not implemented.
 */
function loadAdapter(name) {
  try {
    const mod = require(path.join(ADAPTER_DIR, `${name}.adapter.js`));
    return mod;
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND') {
      logger.warn(`[Fulfillment] adapter '${name}' not found, falling back to local`);
      return require(path.join(ADAPTER_DIR, 'local.adapter.js'));
    }
    throw err;
  }
}

class FulfillmentService {
  // ── Providers ──────────────────────────────────────────────────────────────
  async listProviders() {
    return await FulfillmentModel.listProviders();
  }

  async createProvider({ name, code, adapter = 'local', isEnabled = true, config = {}, webhookSecret } = {}) {
    return await FulfillmentModel.createProvider({ name, code, adapter, is_enabled: isEnabled, config, webhook_secret: webhookSecret });
  }

  async updateProvider(id, updates) {
    return await FulfillmentModel.updateProvider(id, updates);
  }

  async getProvider(id) {
    return await FulfillmentModel.findProvider(id);
  }

  // ── Shipments ─────────────────────────────────────────────────────────────
  async createShipment({ orderId, providerId, payload = {} } = {}) {
    const provider = await FulfillmentModel.findProvider(providerId);
    if (!provider) throw new Error('Fulfillment provider not found');
    if (!provider.is_enabled) throw new Error('Fulfillment provider is disabled');

    const order = await OrderModel.findById(orderId, SINGLE_STORE_ID);
    if (!order) throw new Error('Order not found');

    const adapter = loadAdapter(provider.adapter);
    const result = await adapter.createShipment(order, provider, payload, { fs, LABEL_DIR });

    fs.mkdirSync(LABEL_DIR, { recursive: true });

    return await FulfillmentModel.createShipment({
      order_id: order.id,
      provider_id: provider.id,
      external_shipment_id: result.external_shipment_id || null,
      status: result.status || 'created',
      tracking_number: result.tracking_number || null,
      label_url: result.label_url || null,
      raw_payload: result.raw || {}
    });
  }

  async listShipments(filters, pagination) {
    return await FulfillmentModel.listShipments(filters, pagination);
  }

  // ── Webhook ingestion ───────────────────────────────────────────────────────
  /**
   * Ingest a provider webhook. Verifies the HMAC signature against the
   * provider's webhook_secret, then lets the adapter map the payload to
   * a canonical status update and applies it to the shipment.
   * @param {string} providerCode
   * @param {string|Buffer} rawBody     - raw request body (for signature)
   * @param {string} signature          - provider signature header
   * @param {object} parsedBody         - parsed JSON payload
   */
  async ingestWebhook(providerCode, rawBody, signature, parsedBody = {}) {
    const provider = await FulfillmentModel.findProviderByCode(providerCode);
    if (!provider) throw new Error('Unknown fulfillment provider');

    const adapter = loadAdapter(provider.adapter);
    if (!adapter.verifyWebhook(rawBody, signature, provider.webhook_secret || '')) {
      const err = new Error('Invalid webhook signature');
      err.statusCode = 401;
      throw err;
    }

    const mapping = adapter.mapWebhook(parsedBody);
    if (!mapping || !mapping.external_shipment_id) {
      logger.warn(`[Fulfillment] webhook for ${providerCode} had no shipment reference`);
      return null;
    }

    const found = await this._findByExternalId(provider.id, mapping.external_shipment_id);
    if (!found) {
      logger.warn(`[Fulfillment] no shipment for external id ${mapping.external_shipment_id}`);
      return null;
    }

    const patch = { status: mapping.status };
    if (mapping.tracking_number) patch.tracking_number = mapping.tracking_number;
    if (mapping.label_url) patch.label_url = mapping.label_url;

    const updated = await FulfillmentModel.updateShipment(found.id, patch, mapping.raw || parsedBody);

    // Sync the parent order so a 3PL "delivered" webhook actually marks the
    // order delivered — previously this only ever updated
    // fulfillment_shipments.status, leaving the order's customer-facing
    // status (and the return-window clock, which depends on delivered_at)
    // permanently out of sync with the real shipment. Never let a sync
    // failure fail the webhook itself — the shipment status above is already
    // durably recorded regardless.
    if (found.order_id) {
      try {
        if (mapping.status === 'delivered') {
          // Reuses the real milestone method (not a bare status write) so
          // return_window_expires_at, notifications, and the order.delivered
          // event all fire the same way a manually-dispatched delivery would.
          await OrderService.markDelivered(found.order_id, {
            note: `Delivered per ${provider.name} tracking update`
          }, null);
        } else if (mapping.status === 'out_for_delivery') {
          // markOutForDelivery also enforces a manual-dispatch-specific
          // delivery_status precondition that 3PL-sourced orders never
          // populate, so transition status directly here instead.
          const order = await OrderModel.findById(found.order_id);
          if (order && await OrderStateMachine.isAllowed(order.status, 'out_for_delivery')) {
            await OrderStateMachine.transition(found.order_id, 'out_for_delivery', {
              note: `Out for delivery per ${provider.name} tracking update`
            });
          }
        }
        // 'cancelled' is intentionally not auto-applied to the order — a
        // shipment-level carrier cancellation has refund/inventory
        // implications that warrant human review via the normal cancel flow,
        // rather than being silently triggered by a webhook.
      } catch (syncErr) {
        logger.warn(`[Fulfillment] Could not sync order ${found.order_id} to '${mapping.status}' from webhook: ${syncErr.message}`);
      }
    }

    return updated;
  }

  async _findByExternalId(providerId, externalId) {
    const { data, error } = await require('../config/supabase')
      .from('fulfillment_shipments')
      .select('*')
      .eq('provider_id', providerId)
      .eq('external_shipment_id', externalId)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  }
}

module.exports = new FulfillmentService();
