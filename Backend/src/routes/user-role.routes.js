const express = require('express');
const userRoleController = require('../controllers/user-role.controller');
const { protect } = require('../middlewares/auth.middleware');
const { hasPermission } = require('../middlewares/permission.middleware');

const router = express.Router();

router.use(protect);
router.use(hasPermission('role:manage'));

router.get('/:userId', userRoleController.getUserRoles);
router.post('/:userId', userRoleController.assignRole);
router.delete('/:userId/:roleId', userRoleController.revokeRole);

module.exports = router;
