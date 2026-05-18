const AuditLogModel = require('../models/audit-log.model');

class AuditService {
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

  // Convenience methods
  async logLogin(req, userId, success = true) {
    await this.log(req, success ? 'user.login.success' : 'user.login.failed', 'user', userId);
  }

  async logAuthLockout(req, userId) {
    await this.log(req, 'user.auth.lockout', 'user', userId);
  }

  async logUpdate(req, resourceType, resourceId, oldValues, newValues) {
    await this.log(req, `${resourceType}.update`, resourceType, resourceId, oldValues, newValues);
  }
}

module.exports = new AuditService();
