const express = require('express');
const router = express.Router();
const ipAllowlistController = require('../../controllers/admin/ip-allowlist.controller');
const requireAdmin = require('../../middlewares/require-admin.middleware');
const { hasPermission } = require('../../middlewares/permission.middleware');

router.use(requireAdmin);

/**
 * @swagger
 * tags:
 *   name: Admin IP Allowlist
 *   description: Manage allowed IP ranges for admin access
 */

router.get('/', hasPermission('rbac:read'), ipAllowlistController.list);
router.post('/', hasPermission('rbac:write'), ipAllowlistController.create);
router.put('/:id', hasPermission('rbac:write'), ipAllowlistController.update);
router.delete('/:id', hasPermission('rbac:write'), ipAllowlistController.delete);

module.exports = router;
