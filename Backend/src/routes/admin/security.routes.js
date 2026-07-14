const express = require('express');
const router = express.Router();
const securityController = require('../../controllers/admin/security.controller');
const requireAdmin = require('../../middlewares/require-admin.middleware');
const { hasPermission } = require('../../middlewares/permission.middleware');

router.use(requireAdmin);

/**
 * @swagger
 * tags:
 *   name: Admin Security
 *   description: 2FA and security settings for admin accounts
 */

router.get('/2fa/status', hasPermission('settings:read'), securityController.get2faStatus);
router.post('/2fa/enable', hasPermission('settings:write'), securityController.enable2fa);
router.post('/2fa/verify', hasPermission('settings:write'), securityController.verify2fa);
router.post('/2fa/disable', hasPermission('settings:write'), securityController.disable2fa);
router.post('/2fa/recovery', hasPermission('settings:write'), securityController.useRecoveryCode);

module.exports = router;
