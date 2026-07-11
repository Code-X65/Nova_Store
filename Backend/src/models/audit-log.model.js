const { supabaseAdmin } = require('../config/supabase');
const { computeDelta, summarizeDelta } = require('../utils/audit-diff');
const { humanizeAction, humanizeActionType } = require('../utils/audit-labels');

// resource_type → table + label column used to resolve a friendly name for
// the affected entity (so we show "iPhone 15" instead of a UUID).
const RESOURCE_TABLES = {
  product: { table: 'products', label: 'name' },
  order: { table: 'orders', label: 'order_number' },
  category: { table: 'product_categories', label: 'name' },
  brand: { table: 'brands', label: 'name' },
  category_attribute: { table: 'category_attributes', label: 'attribute_name' },
  product_variant: { table: 'product_variants', label: 'name' },
  product_review: { table: 'product_reviews', label: 'title' },
  invitation: { table: 'invitations', label: 'email' },
  user: { table: 'users', label: '__user' },
};

function formatUserName(u) {
  if (!u) return null;
  const name = `${u.first_name || ''} ${u.last_name || ''}`.trim();
  return name || u.email || null;
}

function withEntityAliases(row) {
  if (!row) return row;
  return {
    ...row,
    entity_type: row.resource_type ?? null,
    entity_id: row.resource_id ?? null,
  };
}

/**
 * Read-time enrichment so the audit dashboard renders human-readable values
 * for BOTH new and legacy rows, without a schema migration:
 *   - friendly action / action-type labels
 *   - resolve actor UUID → real name (when actor_full_name is absent)
 *   - resolve entity UUID → meaningful label (product name, order #, etc.)
 */
async function enrich(rows) {
  if (!rows || rows.length === 0) return rows;
  try {
    for (const r of rows) {
      r.action_label = humanizeAction(r.action);
      r.action_type_label = humanizeActionType(r.action_type);
    }

    // Resolve actor names for rows missing actor_full_name.
    const actorIds = [...new Set(rows.filter((r) => !r.actor_full_name && r.user_id).map((r) => r.user_id))];
    if (actorIds.length) {
      const { data } = await supabaseAdmin
        .from('users')
        .select('id, first_name, last_name, email')
        .in('id', actorIds);
      const map = new Map((data || []).map((u) => [u.id, formatUserName(u)]));
      for (const r of rows) {
        if (!r.actor_full_name && r.user_id && map.has(r.user_id)) {
          r.actor_full_name = map.get(r.user_id);
        }
      }
    }

    // Resolve entity labels per resource type.
    const idsByType = {};
    for (const r of rows) {
      if (r.resource_type && r.resource_id && !r.resource_label) {
        (idsByType[r.resource_type] ||= []).push(r.resource_id);
      }
    }
    for (const [type, ids] of Object.entries(idsByType)) {
      const cfg = RESOURCE_TABLES[type];
      if (!cfg) continue;
      const uniq = [...new Set(ids)];
      if (type === 'user') {
        const { data } = await supabaseAdmin
          .from('users')
          .select('id, first_name, last_name, email')
          .in('id', uniq);
        const labelMap = new Map((data || []).map((u) => [u.id, formatUserName(u)]));
        for (const r of rows) {
          if (r.resource_type === 'user' && !r.resource_label && labelMap.has(r.resource_id)) {
            r.resource_label = labelMap.get(r.resource_id);
          }
        }
      } else {
        const { data } = await supabaseAdmin
          .from(cfg.table)
          .select(`id, ${cfg.label}`)
          .in('id', uniq);
        const labelMap = new Map((data || []).map((x) => [x.id, x[cfg.label]]));
        for (const r of rows) {
          if (r.resource_type === type && !r.resource_label && labelMap.has(r.resource_id)) {
            r.resource_label = labelMap.get(r.resource_id);
          }
        }
      }
    }
  } catch (err) {
    console.error('[AuditLog] enrichment error (non-fatal):', err.message);
  }
  return rows;
}

class AuditLogModel {
  /**
   * Persist an audit event.
   * @param {object} e
   * @param {string} e.userId
   * @param {string} e.action
   * @param {string} e.resourceType
   * @param {string} e.resourceId
   * @param {object} [e.oldValues]
   * @param {object} [e.newValues]
   * @param {string} [e.ip]
   * @param {string} [e.userAgent]
   * @param {string} [e.requestId]
   * @param {string} [e.eventId]
   * @param {string} [e.severity]   - info | warning | critical
   * @param {string} [e.actionType] - CREATE | UPDATE | DELETE | LOGIN | STATUS_CHANGE | OTHER
   * @param {string} [e.actorFullName]
   * @param {string} [e.actorRole]
   * @param {string} [e.actorSessionId]
   * @param {Array}  [e.delta]
   * @param {string} [e.summary]
   */
  async log(e) {
    const {
      userId, action, resourceType, resourceId,
      oldValues, newValues, ip, userAgent, requestId,
      eventId, severity = 'info', actionType,
      actorFullName, actorRole, actorSessionId,
      delta, summary,
    } = e;

    // Auto-compute delta/summary when raw states are supplied but not provided.
    let finalDelta = delta;
    let finalSummary = summary;
    if ((!finalDelta || !finalSummary) && (oldValues || newValues)) {
      const computed = computeDelta(oldValues, newValues);
      finalDelta = finalDelta || computed.delta;
      finalSummary = finalSummary || computed.summary;
    }

    const { data, error } = await supabaseAdmin.from('audit_logs').insert([{
      user_id: userId || null,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      old_values: oldValues ?? null,
      new_values: newValues ?? null,
      ip_address: ip,
      user_agent: userAgent,
      request_id: requestId,
      event_id: eventId || null,
      severity,
      action_type: actionType || null,
      actor_full_name: actorFullName || null,
      actor_role: actorRole || null,
      actor_session_id: actorSessionId || null,
      delta: finalDelta || null,
      summary: finalSummary || null,
    }]).select().single();

    if (error) {
      console.error('Audit log failed:', error);
      // We don't usually throw here to avoid failing the main transaction if logging fails
    }
    return data ? withEntityAliases(data) : data;
  }

  /**
   * Query admin-specific audit log entries.
   */
  async findAdminEvents({ userId, actionPrefix = 'admin.', fromDate, toDate, page = 1, limit = 50 } = {}) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabaseAdmin
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .ilike('action', `${actionPrefix}%`)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (userId) query = query.eq('user_id', userId);
    if (fromDate) query = query.gte('created_at', fromDate);
    if (toDate) query = query.lte('created_at', toDate);

    const { data, error, count } = await query;
    if (error) {
      console.error('Audit log findAdminEvents failed:', error);
      throw error;
    }
    const enriched = await enrich(data || []);
    return { logs: enriched.map(withEntityAliases), total: count, page, limit };
  }

  /**
   * Query general system activity logs with the enriched filter set.
   */
  async findAll({
    userId, action, resourceType, resourceId,
    severity, actionType, actor, q,
    fromDate, toDate, page = 1, limit = 50,
  } = {}) {
    const from = (parseInt(page) - 1) * parseInt(limit);
    const to = from + parseInt(limit) - 1;

    let query = supabaseAdmin
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (userId) query = query.eq('user_id', userId);
    if (action) {
      if (action.includes('%')) query = query.like('action', action);
      else query = query.eq('action', action);
    }
    if (resourceType) query = query.eq('resource_type', resourceType);
    if (resourceId) query = query.eq('resource_id', resourceId);
    if (severity) query = query.eq('severity', severity);
    if (actionType) query = query.eq('action_type', actionType);
    if (actor) {
      // Match against actor name, role, or the acting user id.
      query = query.or(`actor_full_name.ilike.%${actor}%,actor_role.ilike.%${actor}%,user_id.eq.${actor}`);
    }
    if (q) {
      query = query.or(`summary.ilike.%${q}%,action.ilike.%${q}%,resource_type.ilike.%${q}%`);
    }
    if (fromDate) query = query.gte('created_at', fromDate);
    if (toDate) query = query.lte('created_at', toDate);

    const { data, error, count } = await query;
    if (error) {
      console.error('AuditLogModel.findAll failed:', error);
      throw error;
    }
    const enriched = await enrich(data || []);
    return { logs: enriched.map(withEntityAliases), total: count, page: parseInt(page), limit: parseInt(limit) };
  }

  /**
   * Fetch all matching rows (no pagination) for CSV/PDF export.
   */
  async findAllExport({
    userId, action, resourceType, resourceId,
    severity, actionType, actor, q, fromDate, toDate,
  } = {}) {
    let query = supabaseAdmin
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false });

    if (userId) query = query.eq('user_id', userId);
    if (action) query = query.eq('action', action);
    if (resourceType) query = query.eq('resource_type', resourceType);
    if (resourceId) query = query.eq('resource_id', resourceId);
    if (severity) query = query.eq('severity', severity);
    if (actionType) query = query.eq('action_type', actionType);
    if (actor) query = query.or(`actor_full_name.ilike.%${actor}%,actor_role.ilike.%${actor}%,user_id.eq.${actor}`);
    if (q) query = query.or(`summary.ilike.%${q}%,action.ilike.%${q}%,resource_type.ilike.%${q}%`);
    if (fromDate) query = query.gte('created_at', fromDate);
    if (toDate) query = query.lte('created_at', toDate);

    const { data, error } = await query;
    if (error) {
      console.error('AuditLogModel.findAllExport failed:', error);
      throw error;
    }
    const enriched = await enrich(data || []);
    return enriched.map(withEntityAliases);
  }

  /**
   * Aggregate statistics of core events.
   */
  async getStats() {
    const getCount = async (action) => {
      const { count, error } = await supabaseAdmin
        .from('audit_logs')
        .select('*', { count: 'exact', head: true })
        .eq('action', action);
      if (error) {
        console.error(`Failed to get count for action "${action}":`, error);
        return 0;
      }
      return count || 0;
    };

    const totalLoginsSuccess = await getCount('user.login.success');
    const totalLoginsFailed = await getCount('user.login.failed');
    const adminLoginsSuccess = await getCount('user.admin_login.success');
    const adminLoginsFailed = await getCount('user.admin_login.failed');
    const userLockouts = await getCount('user.auth.lockout');
    const adminLockouts = await getCount('admin.auth.lockout');

    return {
      totalLogins: totalLoginsSuccess + totalLoginsFailed,
      failedLogins: totalLoginsFailed,
      adminLogins: adminLoginsSuccess,
      failedAdminLogins: adminLoginsFailed,
      lockouts: userLockouts,
      adminLockouts: adminLockouts,
    };
  }
}

module.exports = new AuditLogModel();
module.exports.withEntityAliases = withEntityAliases;
module.exports.summarizeDelta = summarizeDelta;
