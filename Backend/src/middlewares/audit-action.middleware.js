const AuditService = require('../services/audit.service');

/**
 * audit-action.middleware.js
 *
 * Declarative, opt-in auto-auditing for CRUD endpoints. The controller sets
 * the relevant state on the request and this middleware writes the audit row
 * *after* the route handler completes (so it captures the actual result).
 *
 * Usage:
 *   router.post('/products', auditAction({
 *     resourceType: 'product',
 *     actionType: 'CREATE',
 *     severity: 'info',
 *     getResourceId: (req) => req.createdResource?.id,   // from res.locals
 *     eventKey: 'catalog.product.created'
 *   }), productController.create);
 *
 * For UPDATE, the controller sets `req.auditBefore` / `req.auditAfter`
 * (or `res.locals.auditBefore` / `res.locals.auditAfter`).
 *
 * The middleware never blocks the response — failures are swallowed by
 * AuditService internally.
 */
function auditAction(spec = {}) {
  const {
    resourceType,
    actionType = 'OTHER',
    action,
    severity = 'info',
    eventId,
    eventKey,
    getResourceId,
  } = spec;

  return function (req, res, next) {
    // Continue to the real handler first.
    next();

    // Defer until the response stream is finished so we capture final state.
    res.once('finish', () => {
      if (res.writableEnded === false) return;
      try {
        const before = req.auditBefore || res.locals.auditBefore || null;
        const after = req.auditAfter || res.locals.auditAfter || res.locals.auditResource || null;
        const resourceId = getResourceId
          ? getResourceId(req, res)
          : (req.params && req.params.id) || (after && after.id) || null;

        AuditService.log(
          req,
          action || `${resourceType}.${actionType.toLowerCase()}`,
          resourceType,
          resourceId,
          before,
          after,
          { severity, actionType, eventId: eventId || eventKey || null }
        );
      } catch (err) {
        console.error('auditAction middleware error:', err);
      }
    });
  };
}

module.exports = auditAction;
