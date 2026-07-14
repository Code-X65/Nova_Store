const express = require('express');
const { hasPermission } = require('../../middlewares/permission.middleware');
const authController = require('../../controllers/auth.controller');

const router = express.Router();

router.use(hasPermission('user:read'));

router.get('/', authController.adminListUsers);
router.patch('/:id', hasPermission('user:write'), authController.adminUpdateUserStatus);

module.exports = router;
