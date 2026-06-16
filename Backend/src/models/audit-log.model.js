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

  /**
   * Query general system activity logs.
   */
  async findAll({ userId, action, resourceType, resourceId, fromDate, toDate, page = 1, limit = 50 } = {}) {
    const from = (parseInt(page) - 1) * parseInt(limit);
    const to = from + parseInt(limit) - 1;

    let query = supabaseAdmin
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (userId) {
      query = query.eq('user_id', userId);
    }
    if (action) {
      if (action.includes('%')) {
        query = query.like('action', action);
      } else {
        query = query.eq('action', action);
      }
    }
    if (resourceType) {
      query = query.eq('resource_type', resourceType);
    }
    if (resourceId) {
      query = query.eq('resource_id', resourceId);
    }
    if (fromDate) {
      query = query.gte('created_at', fromDate);
    }
    if (toDate) {
      query = query.lte('created_at', toDate);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('AuditLogModel.findAll failed:', error);
      throw error;
    }

    return { logs: data, total: count, page: parseInt(page), limit: parseInt(limit) };
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
      adminLockouts: adminLockouts
    };
  }
}

module.exports = new AuditLogModel();

