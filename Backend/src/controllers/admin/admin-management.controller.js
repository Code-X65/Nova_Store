const userModel = require('../../models/user.model');
const roleModel = require('../../models/role.model');
const userRoleModel = require('../../models/user-role.model');
const permissionModel = require('../../models/permission.model');
const AuditService = require('../../services/audit.service');
const logger = require('../../utils/logger');

/**
 * AdminManagementController — STORE_OWNER & MANAGER
 *
 * Handles CRUD operations on admin/staff users:
 *   GET    /admin/admins               - listAdmins
 *   GET    /admin/admins/:id           - getAdmin
 *   PATCH  /admin/admins/:id/roles     - updateAdminRoles
 *   PATCH  /admin/admins/:id/permissions - updateAdminPermissions
 *   DELETE /admin/admins/:id           - revokeAdminAccess (soft delete)
 *   GET    /admin/admins/:id/permissions - getAdminPermissions
 *   GET    /admin/my-permissions       - getMyPermissions (any staff)
 */
class AdminManagementController {
  /**
   * GET /api/v1/admin/admins
   */
  async listAdmins(req, res, next) {
    try {
      const { role, search, page = 1, limit = 20 } = req.query;
      const result = await userModel.findAdmins({
        role,
        search,
        page: parseInt(page),
        limit: parseInt(limit)
      });
      return res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/admin/admins/:id
   */
  async getAdmin(req, res, next) {
    try {
      const { id } = req.params;
      const user = await userModel.findById(id);

      if (!user) {
        return res.status(404).json({ success: false, error: 'Admin user not found.' });
      }

      // Must be a staff-grade user
      const { roles, permissions } = await userModel.getUserRolesAndPermissions(id);
      const STAFF_ROLES = ['STORE_OWNER', 'MANAGER', 'ORDER_STAFF', 'INVENTORY_STAFF'];
      const hasAdminRole = roles.some(r => STAFF_ROLES.includes(r));
      if (!hasAdminRole) {
        return res.status(404).json({ success: false, error: 'Admin user not found.' });
      }

      const requesterRoles = req.admin.roles || [];
      const isStoreOwner = requesterRoles.includes('STORE_OWNER');

      // A manager cannot view details of STORE_OWNER or other MANAGER accounts (except self)
      if (!isStoreOwner && (roles.includes('STORE_OWNER') || roles.includes('MANAGER')) && id !== req.admin.id) {
        return res.status(403).json({ success: false, error: 'Forbidden: Managers cannot view other managers or owners.' });
      }

      const { password_hash: _ph, ...safeUser } = user;
      return res.json({
        success: true,
        data: { ...safeUser, roles, permissions }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /api/v1/admin/admins/:id/roles
   * Body: { roleIds: uuid[] }
   */
  async updateAdminRoles(req, res, next) {
    try {
      const { id } = req.params;
      const { roleIds } = req.body;

      if (!Array.isArray(roleIds) || roleIds.length === 0) {
        return res.status(400).json({ success: false, error: 'roleIds must be a non-empty array of UUIDs.' });
      }

      // Prevent a user from modifying their own roles
      if (id === req.admin.id) {
        return res.status(400).json({ success: false, error: 'You cannot modify your own roles.' });
      }

      const user = await userModel.findById(id);
      if (!user) {
        return res.status(404).json({ success: false, error: 'Admin user not found.' });
      }

      const targetRoleObjs = [];
      for (const roleId of roleIds) {
        const role = await roleModel.findById(roleId);
        if (!role) {
          return res.status(400).json({ success: false, error: `Role with ID ${roleId} not found.` });
        }
        targetRoleObjs.push(role);
      }

      const { roles: currentRoles } = await userModel.getUserRolesAndPermissions(id);
      const requesterRoles = req.admin.roles || [];
      const isStoreOwner = requesterRoles.includes('STORE_OWNER');

      // A manager cannot update roles for STORE_OWNER or other MANAGERs
      if (!isStoreOwner) {
        if (currentRoles.includes('STORE_OWNER') || currentRoles.includes('MANAGER')) {
          return res.status(403).json({ success: false, error: 'Forbidden: Managers cannot modify roles of other managers or owners.' });
        }
        // A manager cannot assign STORE_OWNER or MANAGER roles
        const assigningHighRole = targetRoleObjs.some(r => r.name === 'STORE_OWNER' || r.name === 'MANAGER');
        if (assigningHighRole) {
          return res.status(403).json({ success: false, error: 'Forbidden: Managers cannot assign Manager or Owner roles.' });
        }
      }

      // Remove all existing roles
      const existingRoles = await userRoleModel.getUserRoles(id);
      for (const role of existingRoles) {
        await userRoleModel.revokeRole(id, role.id);
      }

      // Assign new roles
      for (const roleId of roleIds) {
        await userRoleModel.assignRole(id, roleId, req.admin.id);
      }

      // Update users.role column to highest assigned role
      const newRoles     = await userRoleModel.getUserRoles(id);
      const roleNames    = newRoles.map(r => r.name);
      const hierarchy    = ['ORDER_STAFF', 'INVENTORY_STAFF', 'MANAGER', 'STORE_OWNER'];
      const primaryRole  = hierarchy.findLast(r => roleNames.includes(r)) || roleNames[0] || 'ORDER_STAFF';
      await userModel.update(id, { role: primaryRole });

      await AuditService.log(req, 'admin_roles_updated', 'user', id, null, { roleIds, newRole: primaryRole }).catch(() => {});

      return res.json({
        success: true,
        message: 'Roles updated.',
        data: { updatedRoles: roleNames, primaryRole }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /api/v1/admin/admins/:id/permissions
   * Body: { permissions: string[] }   — extra permission slugs added to the admin
   */
  async updateAdminPermissions(req, res, next) {
    try {
      const { id } = req.params;
      const { permissions } = req.body;

      if (!Array.isArray(permissions)) {
        return res.status(400).json({ success: false, error: 'permissions must be an array of permission slugs.' });
      }

      const { roles: targetRoles } = await userModel.getUserRolesAndPermissions(id);
      const requesterRoles = req.admin.roles || [];
      const isStoreOwner = requesterRoles.includes('STORE_OWNER');

      // A manager cannot modify permissions for STORE_OWNER or other MANAGERs
      if (!isStoreOwner) {
        if (targetRoles.includes('STORE_OWNER') || targetRoles.includes('MANAGER')) {
          return res.status(403).json({ success: false, error: 'Forbidden: Managers cannot modify permissions of other managers or owners.' });
        }
      }

      // Validate all permission slugs exist in DB
      const allPerms = await permissionModel.findAll ? await permissionModel.findAll() : [];
      const validKeys = new Set(allPerms.map(p => p.key));

      const invalid = permissions.filter(p => p !== '*' && !validKeys.has(p));
      if (invalid.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Unknown permission slug(s): ${invalid.join(', ')}`
        });
      }

      // Store extra permissions on the users table in a custom column
      await userModel.update(id, { extra_permissions: permissions });

      await AuditService.log(req, 'admin_permissions_updated', 'user', id, null, { permissions }).catch(() => {});

      return res.json({
        success: true,
        message: 'Permission update recorded. Changes take effect on next login.',
        data: { updatedPermissions: permissions }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/v1/admin/admins/:id
   * Soft-delete: set is_active = false
   */
  async revokeAdminAccess(req, res, next) {
    try {
      const { id } = req.params;

      if (id === req.admin.id) {
        return res.status(400).json({ success: false, error: 'You cannot revoke your own access.' });
      }

      const user = await userModel.findById(id);
      if (!user) {
        return res.status(404).json({ success: false, error: 'Admin user not found.' });
      }

      // Check roles of target and requester
      const { roles: targetRoles } = await userModel.getUserRolesAndPermissions(id);
      const requesterRoles = req.admin.roles || [];
      const isStoreOwner = requesterRoles.includes('STORE_OWNER');

      // A manager cannot revoke STORE_OWNER or other MANAGER accounts
      if (!isStoreOwner) {
        if (targetRoles.includes('STORE_OWNER') || targetRoles.includes('MANAGER')) {
          return res.status(403).json({ success: false, error: 'Forbidden: Managers cannot revoke other managers or owners.' });
        }
      }

      await userModel.update(id, { is_active: false });

      await AuditService.log(req, 'admin_access_revoked', 'user', id, null, { email: user.email }).catch(() => {});

      logger.info(`[AdminManagement] Admin access revoked for user ${id} by ${req.admin.id}`);

      return res.json({ success: true, message: 'Admin access revoked.' });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/admin/admins/:id/permissions
   * Return the effective permissions for a specific admin.
   */
  async getAdminPermissions(req, res, next) {
    try {
      const { id } = req.params;
      const { roles, permissions } = await userModel.getUserRolesAndPermissions(id);
      const requesterRoles = req.admin.roles || [];
      const isStoreOwner = requesterRoles.includes('STORE_OWNER');

      // A manager cannot view permissions of STORE_OWNER or other MANAGER accounts (except self)
      if (!isStoreOwner && (roles.includes('STORE_OWNER') || roles.includes('MANAGER')) && id !== req.admin.id) {
        return res.status(403).json({ success: false, error: 'Forbidden: Managers cannot view permissions of other managers or owners.' });
      }

      return res.json({ success: true, data: { roles, permissions } });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/admin/my-permissions
   * Self-service: any admin can view their own role and permissions.
   */
  async getMyPermissions(req, res, next) {
    try {
      return res.json({
        success: true,
        data: {
          role: req.admin.role,
          roles: req.admin.roles,
          permissions: req.admin.permissions
        }
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AdminManagementController();
