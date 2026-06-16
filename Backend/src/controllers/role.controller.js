const roleModel = require('../models/role.model');
const AuditService = require('../services/audit.service');

class RoleController {
  async getAllRoles(req, res, next) {
    try {
      const roles = await roleModel.findAll();
      res.status(200).json({ success: true, data: { roles } });
    } catch (error) {
      next(error);
    }
  }

  async getRoleById(req, res, next) {
    try {
      const role = await roleModel.findById(req.params.id);
      if (!role) {
        const error = new Error('Role not found');
        error.statusCode = 404;
        throw error;
      }
      res.status(200).json({ success: true, data: { role } });
    } catch (error) {
      next(error);
    }
  }

  async createRole(req, res, next) {
    try {
      const { name, display_name, description, permissionIds } = req.body;
      const role = await roleModel.create({ name, display_name, description });
      
      if (permissionIds && permissionIds.length > 0) {
        await roleModel.assignPermissions(role.id, permissionIds);
      }
      
      AuditService.log(req, 'role.created', 'role', role.id, null, { name, display_name, permissionIds });
      res.status(201).json({ success: true, data: { role } });
    } catch (error) {
      next(error);
    }
  }

  async updateRole(req, res, next) {
    try {
      const { id } = req.params;
      const oldRole = await roleModel.findById(id);
      const role = await roleModel.update(id, req.body);
      
      const oldValues = oldRole ? { name: oldRole.name, display_name: oldRole.display_name, description: oldRole.description } : null;
      const newValues = { name: role.name, display_name: role.display_name, description: role.description };
      
      AuditService.log(req, 'role.updated', 'role', id, oldValues, newValues);
      res.status(200).json({ success: true, data: { role } });
    } catch (error) {
      next(error);
    }
  }

  async deleteRole(req, res, next) {
    try {
      const { id } = req.params;
      const role = await roleModel.findById(id);
      if (role && role.is_system) {
        const error = new Error('Cannot delete system roles');
        error.statusCode = 403;
        throw error;
      }
      
      await roleModel.delete(id);
      AuditService.log(req, 'role.deleted', 'role', id);
      res.status(200).json({ success: true, message: 'Role deleted' });
    } catch (error) {
      next(error);
    }
  }

  async assignPermissions(req, res, next) {
    try {
      const { id } = req.params;
      const { permissionIds } = req.body;
      await roleModel.assignPermissions(id, permissionIds);
      AuditService.log(req, 'role.permissions.assigned', 'role', id, null, { permissionIds });
      res.status(200).json({ success: true, message: 'Permissions assigned' });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new RoleController();
