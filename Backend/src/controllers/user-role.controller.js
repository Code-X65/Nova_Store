const userRoleModel = require('../models/user-role.model');
const roleModel = require('../models/role.model');
const userModel = require('../models/user.model');
const AuditService = require('../services/audit.service');
const { resolvePrimaryRole } = require('../middlewares/require-admin.middleware');

const HIGH_PRIVILEGE_ROLES = ['STORE_OWNER', 'MANAGER'];

/**
 * Guard shared by assignRole/revokeRole: prevents a non-STORE_OWNER actor from
 * modifying their own roles, or the roles of anyone currently holding
 * STORE_OWNER/MANAGER. Mirrors admin-management.controller.js's updateAdminRoles.
 * Returns an error response object to send, or null if the request may proceed.
 */
async function checkHierarchyGuard(actor, userId) {
  const actorPermissions = actor?.permissions || [];
  const isStoreOwner = actorPermissions.includes('*');

  if (userId === actor?.id) {
    return { status: 400, error: 'You cannot modify your own roles.' };
  }

  if (!isStoreOwner) {
    const targetRoles = (await userRoleModel.getUserRoles(userId)).map(r => r.name);
    if (targetRoles.some(r => HIGH_PRIVILEGE_ROLES.includes(r))) {
      return { status: 403, error: 'Forbidden: cannot modify roles of a Manager or Store Owner.' };
    }
  }

  return null;
}

/**
 * For non-STORE_OWNER actors, ensures every role being assigned is not itself
 * STORE_OWNER/MANAGER by name, AND that its effective permission set is a
 * subset of the actor's own — closes the "custom role, innocuous name, but
 * elevated permissions" bypass of a purely name-based check.
 */
async function checkRoleCeiling(actor, roleIds) {
  const actorPermissions = actor?.permissions || [];
  if (actorPermissions.includes('*')) return null;

  for (const roleId of roleIds) {
    const role = await roleModel.findById(roleId);
    if (!role) {
      return { status: 400, error: `Role with ID ${roleId} not found.` };
    }
    if (HIGH_PRIVILEGE_ROLES.includes(role.name)) {
      return { status: 403, error: 'Forbidden: cannot assign Manager or Store Owner roles.' };
    }
    const roleKeys = (role.permissions || []).map(rp => rp.permissions?.key).filter(Boolean);
    const excess = roleKeys.filter(key => !actorPermissions.includes(key));
    if (excess.length > 0) {
      return { status: 403, error: `Forbidden: role "${role.name}" grants permissions you do not hold yourself: ${excess.join(', ')}` };
    }
  }

  return null;
}

/** Recompute and persist users.role from the user's current highest-privilege role. */
async function syncPrimaryRole(userId) {
  const roles = await userRoleModel.getUserRoles(userId);
  const roleNames = roles.map(r => r.name);
  const primaryRole = resolvePrimaryRole(roleNames) || roleNames[0] || 'ORDER_STAFF';
  await userModel.update(userId, { role: primaryRole });
}

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
      const actor = req.admin || req.user;

      if (!Array.isArray(roleIds) || roleIds.length === 0) {
        return res.status(400).json({ success: false, error: 'roleIds must be a non-empty array.' });
      }

      const hierarchyError = await checkHierarchyGuard(actor, userId);
      if (hierarchyError) return res.status(hierarchyError.status).json({ success: false, error: hierarchyError.error });

      const ceilingError = await checkRoleCeiling(actor, roleIds);
      if (ceilingError) return res.status(ceilingError.status).json({ success: false, error: ceilingError.error });

      const assignments = await Promise.all(
        roleIds.map(roleId => userRoleModel.assignRole(userId, roleId, actor.id))
      );

      await syncPrimaryRole(userId);

      AuditService.log(req, 'user.role.assigned', 'user', userId, null, { roleIds });
      res.status(200).json({ success: true, message: 'Roles assigned', data: assignments });
    } catch (error) {
      next(error);
    }
  }

  async revokeRole(req, res, next) {
    try {
      const { userId, roleId } = req.params;
      const actor = req.admin || req.user;

      const hierarchyError = await checkHierarchyGuard(actor, userId);
      if (hierarchyError) return res.status(hierarchyError.status).json({ success: false, error: hierarchyError.error });

      await userRoleModel.revokeRole(userId, roleId);
      await syncPrimaryRole(userId);

      AuditService.log(req, 'user.role.revoked', 'user', userId, null, { roleId });
      res.status(200).json({ success: true, message: 'Role revoked' });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new UserRoleController();
