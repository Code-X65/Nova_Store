const AuditLogModel = require('../models/audit-log.model');

class AuditService {
  /**
   * Core log method — requires an Express req object for IP/user-agent/requestId context.
   */
  async log(req, action, resourceType, resourceId, oldValues = null, newValues = null) {
    try {
      const userId = req.user ? req.user.id : null;
      const ip = req.ip || req.connection?.remoteAddress;
      const userAgent = req.get('user-agent') || 'unknown';
      const requestId = req.id || null;

      await AuditLogModel.log({
        userId,
        action,
        resourceType,
        resourceId,
        oldValues,
        newValues,
        ip,
        userAgent,
        requestId
      });
    } catch (err) {
      console.error('Audit service error:', err);
    }
  }

  /**
   * Service-layer log — use when no req object is available (e.g. inside auth.service).
   * @param {string} action
   * @param {string} resourceType
   * @param {string|null} resourceId
   * @param {object} meta - { userId, ip, userAgent, requestId, oldValues, newValues }
   */
  async logRaw(action, resourceType, resourceId, meta = {}) {
    try {
      await AuditLogModel.log({
        userId: meta.userId || null,
        action,
        resourceType,
        resourceId,
        oldValues: meta.oldValues || null,
        newValues: meta.newValues || null,
        ip: meta.ip || null,
        userAgent: meta.userAgent || 'service-layer',
        requestId: meta.requestId || null
      });
    } catch (err) {
      console.error('Audit service (logRaw) error:', err);
    }
  }

  // ─── Customer convenience methods ──────────────────────────────────────────

  async logLogin(req, userId, success = true) {
    await this.log(req, success ? 'user.login.success' : 'user.login.failed', 'user', userId);
  }

  async logAuthLockout(req, userId) {
    await this.log(req, 'user.auth.lockout', 'user', userId);
  }

  async logUpdate(req, resourceType, resourceId, oldValues, newValues) {
    await this.log(req, `${resourceType}.update`, resourceType, resourceId, oldValues, newValues);
  }

  // ─── Admin-specific convenience methods ────────────────────────────────────

  /**
   * Log an admin login attempt (success or failure).
   * Accepts either a req object or a raw meta object for service-layer calls.
   */
  async logAdminLogin(reqOrMeta, userId, success = true) {
    const action = success ? 'admin.login.success' : 'admin.login.failed';
    if (reqOrMeta && typeof reqOrMeta.get === 'function') {
      await this.log(reqOrMeta, action, 'user', userId);
    } else {
      await this.logRaw(action, 'user', userId, reqOrMeta || {});
    }
  }

  /**
   * Log an admin account lockout event.
   */
  async logAdminLockout(reqOrMeta, userId) {
    if (reqOrMeta && typeof reqOrMeta.get === 'function') {
      await this.log(reqOrMeta, 'admin.auth.lockout', 'user', userId);
    } else {
      await this.logRaw('admin.auth.lockout', 'user', userId, reqOrMeta || {});
    }
  }

  /**
   * Log the creation of a new admin account.
   * @param {object} req - Express request (the super-admin making the call)
   * @param {string} newAdminId - The newly created admin's user ID
   */
  async logAdminRegister(req, newAdminId) {
    await this.log(req, 'admin.register', 'user', newAdminId);
  }

  /**
   * Log revocation of an admin session.
   * @param {object} req
   * @param {string} targetUserId - Whose session was revoked
   * @param {string} sessionId   - Session identifier
   */
  async logAdminSessionRevoked(req, targetUserId, sessionId) {
    await this.log(req, 'admin.session.revoked', 'session', sessionId, null, { targetUserId });
  }

  /**
   * Log a password change for an admin account.
   */
  async logAdminPasswordChange(req, userId) {
    await this.log(req, 'admin.password.changed', 'user', userId);
  }
}

module.exports = new AuditService();
