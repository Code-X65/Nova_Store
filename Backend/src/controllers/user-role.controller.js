const userRoleModel = require('../models/user-role.model');
const AuditService = require('../services/audit.service');

class UserRoleController {
  async getUserRoles(req, res, next) {
    try {
      const roles = await userRoleModel.getUserRoles(req.params.userId);
      res.status(200).json({ success: true, data: { userId: req.params.userId, roles } });
    } catch (error) {
      next(error);
    }
  }

  async assignRole(req, res, next) {
    try {
      const { roleIds } = req.body;
      const { userId } = req.params;
      
      const assignments = await Promise.all(
        roleIds.map(roleId => userRoleModel.assignRole(userId, roleId, req.user.id))
      );
      
      AuditService.log(req, 'user.role.assigned', 'user', userId, null, { roleIds });
      res.status(200).json({ success: true, message: 'Roles assigned', data: assignments });
    } catch (error) {
      next(error);
    }
  }

  async revokeRole(req, res, next) {
    try {
      const { userId, roleId } = req.params;
      await userRoleModel.revokeRole(userId, roleId);
      AuditService.log(req, 'user.role.revoked', 'user', userId, null, { roleId });
      res.status(200).json({ success: true, message: 'Role revoked' });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new UserRoleController();
