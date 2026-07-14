const userModel = require('../../models/user.model');
const sessionModel = require('../../models/session.model');
const permissionModel = require('../../models/permission.model');
const AuditService = require('../../services/audit.service');
const realtime = require('../../services/realtime.service');
const logger = require('../../utils/logger');

const HIERARCHY = ['ORDER_STAFF', 'INVENTORY_STAFF', 'MANAGER', 'STORE_OWNER'];

/**
 * Determine whether `actor` (req.admin) may manage `targetRoles`.
 * Reuses the existing rules from admin-management.controller:
 *   - Managers cannot touch STORE_OWNER or other MANAGER accounts.
 *   - Nobody may modify themselves (enforced by caller per-action).
 */
function canManageTarget(actorRoles, targetRoles) {
  const isStoreOwner = actorRoles.includes('STORE_OWNER');
  if (isStoreOwner) return true;
  if (targetRoles.includes('STORE_OWNER') || targetRoles.includes('MANAGER')) {
    return false;
  }
  return true;
}

class AccessController {
  // ─── Lock ──────────────────────────────────────────────────────────────────
  async lock(req, res, next) {
    try {
      const { id } = req.params;
      const reason = (req.body?.reason || '').toString().slice(0, 500) || null;

      const user = await userModel.findById(id);
      if (!user) return res.status(404).json({ success: false, error: 'Admin user not found.' });
      if (id === req.admin.id) return res.status(400).json({ success: false, error: 'You cannot lock your own account.' });

      const { roles: targetRoles } = await userModel.getUserRolesAndPermissions(id);
      if (!canManageTarget(req.admin.roles, targetRoles)) {
        return res.status(403).json({ success: false, error: 'Forbidden: insufficient privilege to lock this account.' });
      }

      await userModel.setLockState(id, { locked: true, reason, lockedBy: req.admin.id });
      // Instantly kill every active session on all devices.
      await sessionModel.revokeAllAdminSessionsForUser(id);

      await AuditService.log(req, 'admin.locked', 'user', id, null, { reason, actor: req.admin.id });
      await realtime.emitAccessChange(id, 'account.locked', { actor: req.admin.id, reason });

      logger.info(`[Access] Account ${id} locked by ${req.admin.id}`);
      return res.json({ success: true, message: 'Account locked. All active sessions were terminated.' });
    } catch (err) { next(err); }
  }

  // ─── Unlock ────────────────────────────────────────────────────────────────
  async unlock(req, res, next) {
    try {
      const { id } = req.params;

      const user = await userModel.findById(id);
      if (!user) return res.status(404).json({ success: false, error: 'Admin user not found.' });

      const { roles: targetRoles } = await userModel.getUserRolesAndPermissions(id);
      if (!canManageTarget(req.admin.roles, targetRoles)) {
        return res.status(403).json({ success: false, error: 'Forbidden: insufficient privilege to unlock this account.' });
      }

      await userModel.setLockState(id, { locked: false });

      await AuditService.log(req, 'admin.unlocked', 'user', id, null, { actor: req.admin.id });
      await realtime.emitAccessChange(id, 'account.unlocked', { actor: req.admin.id });

      return res.json({ success: true, message: 'Account unlocked.' });
    } catch (err) { next(err); }
  }

  // ─── Remove (permanent purge) ──────────────────────────────────────────────
  async remove(req, res, next) {
    try {
      const { id } = req.params;
      const reason = (req.body?.reason || '').toString().slice(0, 500) || null;

      if (id === req.admin.id) return res.status(400).json({ success: false, error: 'You cannot remove your own account.' });

      const user = await userModel.findById(id);
      if (!user) return res.status(404).json({ success: false, error: 'Admin user not found.' });

      const { roles: targetRoles } = await userModel.getUserRolesAndPermissions(id);
      if (!canManageTarget(req.admin.roles, targetRoles)) {
        return res.status(403).json({ success: false, error: 'Forbidden: insufficient privilege to remove this account.' });
      }

      // Forensic snapshot BEFORE hard delete.
      const { supabaseAdmin } = require('../../config/supabase');
      await supabaseAdmin.from('admin_purges').insert([{
        purged_user_id: id,
        email: user.email,
        full_name: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
        roles: targetRoles,
        snapshot: { user },
        purged_by: req.admin.id,
        reason
      }]);

      // Kill sessions and purge dependent rows.
      await sessionModel.revokeAllAdminSessionsForUser(id);
      await userModel.hardDeleteAdmin(id, user.email);

      await AuditService.log(req, 'admin.removed', 'user', id, null, { email: user.email, actor: req.admin.id });
      await realtime.emitAccessChange(id, 'account.removed', { actor: req.admin.id });

      logger.info(`[Access] Account ${id} (${user.email}) permanently removed by ${req.admin.id}`);
      return res.json({ success: true, message: 'Administrator profile permanently removed.' });
    } catch (err) { next(err); }
  }

}

module.exports = new AccessController();
