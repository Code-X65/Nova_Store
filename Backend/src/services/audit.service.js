const AuditLogModel = require('../models/audit-log.model');
const { computeDelta } = require('../utils/audit-diff');

/**
 * Resolve actor identity from the request context (set by auth/require-admin
 * middleware, or enriched by audit-context middleware).
 */
function resolveActor(req, override) {
  if (override) return override;
  if (req && req.actor) {
    return {
      id: req.actor.id,
      fullName: req.actor.fullName,
      role: req.actor.role,
      sessionId: req.actor.sessionId,
    };
  }
  const principal = req && (req.admin || req.user);
  if (principal) {
    const first = principal.firstName || principal.first_name || '';
    const last = principal.lastName || principal.last_name || '';
    const fullName = `${first} ${last}`.trim() || principal.email || null;
    return {
      id: principal.id,
      fullName,
      role: principal.role || (principal.roles && principal.roles[0]) || null,
      sessionId: req && (req.sessionID || req.session?.id) ? (req.sessionID || req.session?.id) : null,
    };
  }
  return null;
}

function clientIp(req) {
  if (!req) return null;
  return req.ip || req.connection?.remoteAddress || null;
}

function userAgentOf(req) {
  if (!req) return 'unknown';
  if (typeof req.get === 'function') return req.get('user-agent') || 'unknown';
  return 'unknown';
}

class AuditService {
  /**
   * Core log method.
   * @param {object} req            - Express request (for ip/ua/requestId/actor)
   * @param {string} action         - e.g. 'product.updated'
   * @param {string} resourceType   - e.g. 'product'
   * @param {string} resourceId
   * @param {object} [oldValues]
   * @param {object} [newValues]
   * @param {object} [opts]         - { severity, actionType, eventId, actor,
   *                                   delta, summary, ip, userAgent, requestId }
   */
  async log(req, action, resourceType, resourceId, oldValues = null, newValues = null, opts = {}) {
    try {
      const actor = resolveActor(req, opts.actor);
      const { delta, summary } = (oldValues || newValues)
        ? computeDelta(oldValues, newValues)
        : { delta: null, summary: null };

      await AuditLogModel.log({
        userId: actor?.id || (req && req.user ? req.user.id : null) || (req && req.admin ? req.admin.id : null) || null,
        action,
        resourceType,
        resourceId,
        oldValues,
        newValues,
        ip: opts.ip || clientIp(req),
        userAgent: opts.userAgent || userAgentOf(req),
        requestId: opts.requestId || (req && req.id ? req.id : null),
        eventId: opts.eventId || null,
        severity: opts.severity || 'info',
        actionType: opts.actionType || null,
        actorFullName: actor?.fullName || null,
        actorRole: actor?.role || null,
        actorSessionId: actor?.sessionId || null,
        delta: opts.delta || delta,
        summary: opts.summary || summary,
      });
    } catch (err) {
      console.error('Audit service error:', err);
    }
  }

  /**
   * Service-layer log — use when no req object is available.
   * @param {string} action
   * @param {string} resourceType
   * @param {string|null} resourceId
   * @param {object} meta - { userId, ip, userAgent, requestId, severity,
   *                         actionType, actor{...}, oldValues, newValues, delta, summary }
   */
  async logRaw(action, resourceType, resourceId, meta = {}) {
    try {
      const { delta, summary } = (meta.oldValues || meta.newValues)
        ? computeDelta(meta.oldValues, meta.newValues)
        : { delta: null, summary: null };

      await AuditLogModel.log({
        userId: meta.userId || null,
        action,
        resourceType,
        resourceId,
        oldValues: meta.oldValues || null,
        newValues: meta.newValues || null,
        ip: meta.ip || null,
        userAgent: meta.userAgent || 'service-layer',
        requestId: meta.requestId || null,
        eventId: meta.eventId || null,
        severity: meta.severity || 'info',
        actionType: meta.actionType || null,
        actorFullName: meta.actor?.fullName || null,
        actorRole: meta.actor?.role || null,
        actorSessionId: meta.actor?.sessionId || null,
        delta: meta.delta || delta,
        summary: meta.summary || summary,
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

  async logUpdate(req, resourceType, resourceId, oldValues, newValues, opts = {}) {
    await this.log(req, `${resourceType}.update`, resourceType, resourceId, oldValues, newValues, {
      actionType: 'UPDATE', ...opts,
    });
  }

  // ─── Admin-specific convenience methods ────────────────────────────────────

  async logAdminLogin(reqOrMeta, userId, success = true) {
    const action = success ? 'admin.login.success' : 'admin.login.failed';
    if (reqOrMeta && typeof reqOrMeta.get === 'function') {
      await this.log(reqOrMeta, action, 'user', userId);
    } else {
      await this.logRaw(action, 'user', userId, reqOrMeta || {});
    }
  }

  async logAdminLockout(reqOrMeta, userId) {
    if (reqOrMeta && typeof reqOrMeta.get === 'function') {
      await this.log(reqOrMeta, 'admin.auth.lockout', 'user', userId);
    } else {
      await this.logRaw('admin.auth.lockout', 'user', userId, reqOrMeta || {});
    }
  }

  async logAdminRegister(req, newAdminId, opts = {}) {
    await this.log(req, 'admin.register', 'user', newAdminId, null, null, {
      actionType: 'CREATE', severity: 'critical', ...opts,
    });
  }

  async logAdminSessionRevoked(req, targetUserId, sessionId) {
    await this.log(req, 'admin.session.revoked', 'session', sessionId, null, { targetUserId }, { actionType: 'OTHER' });
  }

  async logAdminPasswordChange(req, userId) {
    await this.log(req, 'admin.password.changed', 'user', userId, null, null, { actionType: 'OTHER' });
  }
}

module.exports = new AuditService();
