const { supabaseAdmin } = require('../config/supabase');
const { computeDelta, summarizeDelta } = require('../utils/audit-diff');
const { humanizeAction, humanizeActionType } = require('../utils/audit-labels');
const crypto = require('crypto');

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
   * Recompute the tamper-evidence hash chain over every audit row in
   * chronological order and compare it against the stored hashes.
   *
   * Two checks per row:
   *   - linkOk: row.prev_record_hash === hash of the previous row
   *   - hashOk: sha256(`${prevRecordHash}|${payload}`) === row.record_hash
   *
   * The chain advances using each row's STORED record_hash, so a single
   * tampered row is localised rather than cascading the break to every
   * subsequent row.
   *
   * @returns {{ total:number, verified:boolean, verifiedCount:number,
   *   brokenCount:number, broken:Array, verifiedAt:string }}
   */
  async verifyChain() {
    const { data, error } = await supabaseAdmin
      .from('audit_logs')
      .select('id, created_at, user_id, action, resource_type, resource_id, old_values, new_values, severity, action_type, actor_full_name, actor_role, resource_sku, delta_numeric, reason_code, record_hash, prev_record_hash')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('AuditLogModel.verifyChain failed:', error);
      throw error;
    }

    const rows = data || [];
    let prevRecordHash = 'GENESIS';
    let verifiedCount = 0;
    const broken = [];

    for (const row of rows) {
      const payload = JSON.stringify({
        userId: row.user_id,
        action: row.action,
        resourceType: row.resource_type,
        resourceId: row.resource_id,
        oldValues: row.old_values,
        newValues: row.new_values,
        severity: row.severity,
        actionType: row.action_type,
        actorFullName: row.actor_full_name,
        actorRole: row.actor_role,
        resourceSku: row.resource_sku,
        deltaNumeric: row.delta_numeric,
        reasonCode: row.reason_code,
      });
      const expectedHash = crypto
        .createHash('sha256')
        .update(`${prevRecordHash}|${payload}`)
        .digest('hex');

      const linkOk = row.prev_record_hash === prevRecordHash;
      const hashOk = row.record_hash === expectedHash;

      if (!linkOk || !hashOk) {
        broken.push({
          id: row.id,
          created_at: row.created_at,
          linkOk,
          hashOk,
          expectedPrevRecordHash: prevRecordHash,
          storedPrevRecordHash: row.prev_record_hash,
          expectedRecordHash: expectedHash,
          storedRecordHash: row.record_hash,
        });
      } else {
        verifiedCount += 1;
      }

      // Advance using the stored hash so a single tamper does not cascade.
      prevRecordHash = row.record_hash || expectedHash;
    }

    return {
      total: rows.length,
      verified: broken.length === 0,
      verifiedCount,
      brokenCount: broken.length,
      broken,
      verifiedAt: new Date().toISOString(),
    };
  }

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
      resourceSku, resourceName, resourceCategory,
      contextLocation, contextBatchLot, deltaNumeric,
      reasonCode, deviceInfo,
    } = e;

    // Auto-compute delta/summary when raw states are supplied but not provided.
    let finalDelta = delta;
    let finalSummary = summary;
    if ((!finalDelta || !finalSummary) && oldValues && newValues) {
      const computed = computeDelta(oldValues, newValues);
      finalDelta = finalDelta || computed.delta;
      finalSummary = finalSummary || computed.summary;
    }

    // Tamper-evidence hash chain (append-only, verifiable off-band). The
    // read-prev-hash + compute + insert sequence runs atomically inside
    // insert_audit_log_with_chain (one RPC call = one transaction, serialized
    // by an advisory lock) — see 102_atomic_audit_hash_chain.sql. This is
    // what actually prevents concurrent audit writes from forking the chain,
    // and a failure here throws instead of silently inserting null hashes.
    // Normalized with `?? null` on every field: verifyChain() rebuilds this
    // same payload later from the stored row, and DB columns always read
    // back as `null` (never `undefined`) for an unset value. Without this
    // normalization, JSON.stringify would omit an undefined field here but
    // include it as `null` on reconstruction — different strings, different
    // hash, a permanent false-positive "broken chain" report on every row
    // that had any optional field unset at write time.
    const chainPayload = JSON.stringify({
      userId: userId ?? null,
      action: action ?? null,
      resourceType: resourceType ?? null,
      resourceId: resourceId ?? null,
      oldValues: oldValues ?? null,
      newValues: newValues ?? null,
      severity: severity ?? null,
      actionType: actionType ?? null,
      actorFullName: actorFullName ?? null,
      actorRole: actorRole ?? null,
      resourceSku: resourceSku ?? null,
      deltaNumeric: deltaNumeric ?? null,
      reasonCode: reasonCode ?? null,
    });

    const { data, error } = await supabaseAdmin.rpc('insert_audit_log_with_chain', {
      p_row: {
        user_id: userId || null,
        action,
        resource_type: resourceType,
        resource_id: resourceId || null,
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
        resource_sku: resourceSku || null,
        resource_name: resourceName || null,
        resource_category: resourceCategory || null,
        context_location: contextLocation || null,
        context_batch_lot: contextBatchLot || null,
        delta_numeric: deltaNumeric ?? null,
        reason_code: reasonCode || null,
        device_info: deviceInfo || null,
      },
      p_chain_payload: chainPayload,
    });

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

  /**
   * Catalog-specific stats: counts by entity type, top actors, recent alerts.
   * Respects audit redaction scope when provided.
   */
  async getCatalogStats(fromDate, toDate, auditScope) {
    const CATALOG_TYPES = {
      products:   'product',
      categories: 'category',
      brands:     'brand',
      attributes: 'category_attribute',
    };

    // getRedactionScope's filter only inspects resource_type/action_type/action/severity/
    // actor_role/user_id on a row — so probing it with a representative synthetic row tells
    // us whether this role can see a given resource_type at all, without duplicating the
    // role logic here or paying for a full row fetch just to compute a count.
    const isTypeVisible = (resourceType) => {
      if (!auditScope) return true;
      if (auditScope.deny) return false;
      if (!auditScope.filter) return true;
      return auditScope.filter({
        resource_type: resourceType,
        action_type: 'CREATE',
        action: `${resourceType}.created`,
        severity: 'info',
      });
    };

    const getCount = async (resourceType, actionType) => {
      if (!isTypeVisible(resourceType)) return 0;
      let q = supabaseAdmin
        .from('audit_logs')
        .select('*', { count: 'exact', head: true })
        .eq('resource_type', resourceType)
        .eq('action_type', actionType);
      if (fromDate) q = q.gte('created_at', fromDate);
      if (toDate) q = q.lte('created_at', toDate);
      const { count, error } = await q;
      if (error) {
        console.error(`Failed to get catalog count for ${resourceType}/${actionType}:`, error);
        return 0;
      }
      return count || 0;
    };

    const totals = {};
    for (const [key, resourceType] of Object.entries(CATALOG_TYPES)) {
      totals[key] = {
        created: await getCount(resourceType, 'CREATE'),
        updated: await getCount(resourceType, 'UPDATE'),
        deleted: await getCount(resourceType, 'DELETE'),
      };
    }

    const visibleTypes = Object.values(CATALOG_TYPES).filter(isTypeVisible);

    // Top actors — scoped to catalog resource types only (this endpoint is catalog-specific)
    // and filtered through the real auditScope predicate, not the synthetic-row probe above.
    let topActors = [];
    if (visibleTypes.length > 0) {
      let actorsQuery = supabaseAdmin
        .from('audit_logs')
        .select('actor_full_name, actor_role, action_type, resource_type, action, severity, user_id')
        .in('resource_type', visibleTypes)
        .gte('created_at', fromDate || '1970-01-01')
        .lte('created_at', toDate || new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(200);

      const { data: actorRows } = await actorsQuery;
      const filteredActorRows = auditScope?.filter ? (actorRows || []).filter(auditScope.filter) : (actorRows || []);
      const actorMap = new Map();
      for (const r of filteredActorRows) {
        const key = `${r.actor_role}:${r.actor_full_name || 'System'}`;
        actorMap.set(key, (actorMap.get(key) || 0) + 1);
      }
      topActors = [...actorMap.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([key, count]) => {
          const [role, fullName] = key.split(':');
          return { actor_role: role, full_name: fullName, count };
        });
    }

    // Recent alerts — same catalog-only scoping and real-filter treatment.
    let alerts = [];
    if (visibleTypes.length > 0) {
      let alertsQuery = supabaseAdmin
        .from('audit_logs')
        .select('id, action, resource_type, created_at, severity, action_type, actor_role, user_id')
        .in('resource_type', visibleTypes)
        .gte('created_at', fromDate || '1970-01-01')
        .lte('created_at', toDate || new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(10);

      const { data: alertRows } = await alertsQuery;
      alerts = auditScope?.filter ? (alertRows || []).filter(auditScope.filter) : (alertRows || []);
    }

    return {
      totals,
      top_actors: topActors,
      recent_alerts: alerts,
    };
  }
}

module.exports = new AuditLogModel();
module.exports.withEntityAliases = withEntityAliases;
module.exports.summarizeDelta = summarizeDelta;
