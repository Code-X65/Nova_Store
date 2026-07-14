const express = require('express');
const FulfillmentController = require('../controllers/admin/fulfillment.controller');

/**
 * Public 3PL webhook ingestion. Mounted OUTSIDE the admin auth guard
 * (3PLs have no session) — requests are authenticated via the
 * provider's HMAC webhook secret, not a user session.
 */
const router = express.Router();

// Capture raw body for HMAC verification (express.json already applied
// globally, but we store the buffer via verify in app.js).
router.post('/:code',
  express.json({ type: '*/*' }),
  FulfillmentController.webhook
);

module.exports = router;
