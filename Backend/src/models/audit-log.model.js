const { supabaseAdmin } = require('../config/supabase');

class AuditLogModel {
  async log({ userId, action, resourceType, resourceId, oldValues, newValues, ip, userAgent, requestId }) {
    const { data, error } = await supabaseAdmin.from('audit_logs').insert([{
      user_id: userId || null,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      old_values: oldValues,
      new_values: newValues,
      ip_address: ip,
      user_agent: userAgent,
      request_id: requestId
    }]).select().single();
    
    if (error) {
      console.error('Audit log failed:', error);
      // We don't usually throw here to avoid failing the main transaction if logging fails
    }
    return data;
  }

  /**
   * Query admin-specific audit log entries.
   * @param {object} filters
   * @param {string} [filters.userId]      - Filter by acting user ID
   * @param {string} [filters.actionPrefix] - e.g. 'admin.' to get all admin events
   * @param {string} [filters.fromDate]    - ISO date string (inclusive)
   * @param {string} [filters.toDate]      - ISO date string (inclusive)
   * @param {number} [filters.page]        - Page number (default 1)
   * @param {number} [filters.limit]       - Results per page (default 50)
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

    if (userId) {
      query = query.eq('user_id', userId);
    }
    if (fromDate) {
      query = query.gte('created_at', fromDate);
    }
    if (toDate) {
      query = query.lte('created_at', toDate);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('Audit log findAdminEvents failed:', error);
      throw error;
    }

    return { logs: data, total: count, page, limit };
  }
}

module.exports = new AuditLogModel();

