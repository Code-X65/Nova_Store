/**
 * audit-redaction.middleware.js
 *
 * Role-aware row-level filter for audit log queries.
 * Attaches req._auditScope so downstream controllers can apply
 * the correct filter before returning data to the client.
 */

function getRedactionScope(req) {
  const actor = req.admin;
  if (!actor) return { deny: true, reason: 'unauthenticated' };

  if (actor.hasRole('STORE_OWNER')) {
    return { deny: false };
  }

  if (actor.hasRole('MANAGER')) {
    return {
      deny: false,
      filter: (row) => {
        if (row.action_type === 'LOGIN') return false;
        if (row.action) {
          if (row.action.startsWith('admin.') || row.action.startsWith('user.admin_login')) return false;
        }
        if (row.severity === 'critical' && row.actor_role !== actor.role && row.user_id !== actor.id) return false;
        return true;
      },
    };
  }

  if (actor.hasRole('ORDER_STAFF')) {
    return {
      deny: false,
      filter: (row) => {
        const allowedTypes = ['order', 'order_item', 'shipment', 'refund', 'return'];
        if (!allowedTypes.includes(row.resource_type)) return false;
        if (!['UPDATE', 'STATUS_CHANGE'].includes(row.action_type)) return false;
        return true;
      },
    };
  }

  if (actor.hasRole('INVENTORY_STAFF')) {
    return {
      deny: false,
      filter: (row) => {
        const allowedTypes = ['product', 'product_variant', 'inventory_transaction', 'stock_adjustment'];
        if (!allowedTypes.includes(row.resource_type)) return false;
        if (row.action_type === 'LOGIN') return false;
        if (row.action && row.action.startsWith('admin.')) return false;
        return true;
      },
    };
  }

  return { deny: true, reason: 'no_audit_scope' };
}

function auditRedaction() {
  return (req, res, next) => {
    const scope = getRedactionScope(req);
    if (scope.deny) {
      return res.status(403).json({ success: false, error: 'Access to audit logs is not permitted for your role.' });
    }
    req._auditScope = scope;
    next();
  };
}

module.exports = { auditRedaction, getRedactionScope };
