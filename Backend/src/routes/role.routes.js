const express = require('express');
const roleController = require('../controllers/role.controller');
const { protect, admin } = require('../middlewares/auth.middleware');
const { hasPermission } = require('../middlewares/permission.middleware');

const router = express.Router();

router.use(protect);
router.use(hasPermission('role:manage')); // Global check for role management

router.get('/', roleController.getAllRoles);
router.get('/:id', roleController.getRoleById);
router.post('/', roleController.createRole);
router.patch('/:id', roleController.updateRole);
router.delete('/:id', roleController.deleteRole);
router.post('/:id/permissions', roleController.assignPermissions);

module.exports = router;
