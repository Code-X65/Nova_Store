const roleModel = require('../models/role.model');

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
      
      res.status(201).json({ success: true, data: { role } });
    } catch (error) {
      next(error);
    }
  }

  async updateRole(req, res, next) {
    try {
      const role = await roleModel.update(req.params.id, req.body);
      res.status(200).json({ success: true, data: { role } });
    } catch (error) {
      next(error);
    }
  }

  async deleteRole(req, res, next) {
    try {
      const role = await roleModel.findById(req.params.id);
      if (role && role.is_system) {
        const error = new Error('Cannot delete system roles');
        error.statusCode = 403;
        throw error;
      }
      
      await roleModel.delete(req.params.id);
      res.status(200).json({ success: true, message: 'Role deleted' });
    } catch (error) {
      next(error);
    }
  }

  async assignPermissions(req, res, next) {
    try {
      await roleModel.assignPermissions(req.params.id, req.body.permissionIds);
      res.status(200).json({ success: true, message: 'Permissions assigned' });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new RoleController();
