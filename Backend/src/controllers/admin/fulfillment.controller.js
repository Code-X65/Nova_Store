const FulfillmentService = require('../../services/fulfillment.service');

class FulfillmentController {
  async listProviders(req, res, next) {
    try {
      const providers = await FulfillmentService.listProviders();
      res.status(200).json({ success: true, data: { providers } });
    } catch (err) {
      next(err);
    }
  }

  async createProvider(req, res, next) {
    try {
      const { name, code, adapter, isEnabled, config, webhookSecret } = req.body;
      if (!name || !code) return res.status(400).json({ success: false, message: 'name and code are required' });
      const provider = await FulfillmentService.createProvider({ name, code, adapter, isEnabled, config, webhookSecret });
      res.status(201).json({ success: true, data: { provider } });
    } catch (err) {
      next(err);
    }
  }

  async updateProvider(req, res, next) {
    try {
      const provider = await FulfillmentService.updateProvider(req.params.id, req.body);
      res.status(200).json({ success: true, data: { provider } });
    } catch (err) {
      next(err);
    }
  }

  async createShipment(req, res, next) {
    try {
      const { orderId, providerId, payload } = req.body;
      if (!orderId || !providerId) return res.status(400).json({ success: false, message: 'orderId and providerId are required' });
      const shipment = await FulfillmentService.createShipment({ orderId, providerId, payload });
      res.status(201).json({ success: true, data: { shipment } });
    } catch (err) {
      next(err);
    }
  }

  async listShipments(req, res, next) {
    try {
      const { orderId, status, page, limit } = req.query;
      const result = await FulfillmentService.listShipments({ orderId, status }, { page: page || 1, limit: limit || 20 });
      res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Public webhook ingestion — verified by provider webhook secret.
   * Raw body must be available (express.json with verify), or we
   * re-parse from req.body. We pass req.body as the parsed payload and
   * the raw body buffer when present.
   */
  async webhook(req, res, next) {
    try {
      const providerCode = req.params.code;
      const raw = req.rawBody || JSON.stringify(req.body);
      const signature = req.headers['x-webhook-signature'] || req.headers['x-signature'] || '';
      const result = await FulfillmentService.ingestWebhook(providerCode, raw, signature, req.body);
      res.status(200).json({ success: true, data: result || null });
    } catch (err) {
      if (err.statusCode === 401) return res.status(401).json({ success: false, message: err.message });
      next(err);
    }
  }
}

module.exports = new FulfillmentController();
