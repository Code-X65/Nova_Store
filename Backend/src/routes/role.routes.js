const express = require('express');
const roleController = require('../controllers/role.controller');
const { protect } = require('../middlewares/auth.middleware');
const { hasPermission } = require('../middlewares/permission.middleware');
const requireAdmin = require('../middlewares/require-admin.middleware');

const router = express.Router();

router.use(protect);

// GET routes require admin access so any staff/manager can list roles (e.g. for invitations)
router.get('/', requireAdmin, roleController.getAllRoles);
router.get('/:id', requireAdmin, roleController.getRoleById);

// Write routes require role:manage permission
router.post('/', hasPermission('role:manage'), roleController.createRole);
router.patch('/:id', hasPermission('role:manage'), roleController.updateRole);
router.delete('/:id', hasPermission('role:manage'), roleController.deleteRole);
router.post('/:id/permissions', hasPermission('role:manage'), roleController.assignPermissions);

module.exports = router;
