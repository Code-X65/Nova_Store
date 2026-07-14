const AuditService = require('../services/audit.service');
const logger = require('../utils/logger');

/**
 * AuditGuard — wraps an async controller method to guarantee an audit log
 * is written after the handler completes, regardless of whether the controller
 * remembered to call AuditService.log().
 *
 * Usage:
 *   const { withAudit } = require('../../utils/audit-guard');
 *
 *   router.put('/:id', withAudit(
 *     productController.update,
 *     { resourceType: 'product', action: 'product.updated', captureBefore: fetchProduct }
 *   ));
 *
 * captureBefore(req) should return the pre-change state (or null).
 * The wrapper automatically resolves resourceId from req.params.id or after.id.
 */
async function withAudit(handler, spec = {}) {
  const {
    resourceType,
    action,
    actionType,
    severity = 'info',
    eventId,
    captureBefore,
    captureAfter,
    getResourceId,
  } = spec;

  return async function auditWrapped(req, res, next) {
    let oldValues = null;
    let resourceId = null;

    try {
      if (captureBefore) {
        oldValues = await captureBefore(req);
      }

      resourceId = getResourceId
        ? getResourceId(req, res)
        : (req.params && req.params.id) || null;

      // Defer audit until the response stream finishes so we capture final state.
      res.once('finish', async () => {
        try {
          const after = captureAfter ? await captureAfter(req, res) : null;
          if (!resourceId && after && after.id) {
            resourceId = after.id;
          }
          await AuditService.log(req, action, resourceType, resourceId, oldValues, after, {
            actionType,
            severity,
            eventId,
          });
        } catch (err) {
          logger.error('[AuditGuard]', err);
        }
      });

      await handler(req, res, next);
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { withAudit };
