const express = require('express');
const router = express.Router();

const { hasPermission } = require('../../middlewares/permission.middleware');
const accessController = require('../../controllers/admin/access.controller');
const sseGateway = require('../../realtime/sse.gateway');

/**
 * Real-time event stream (SSE). Authenticated via the global requireAdmin
 * middleware applied to /api/v1/admin. CSRF is exempt (GET).
 */
router.get('/stream', sseGateway.registerSse);

/**
 * Account lifecycle — Super Admin (STORE_OWNER) only.
 */
router.post('/access/:id/lock',   hasPermission('staff:write'), accessController.lock);
router.post('/access/:id/unlock', hasPermission('staff:write'), accessController.unlock);
router.delete('/access/:id/remove', hasPermission('staff:write'), accessController.remove);

module.exports = router;
