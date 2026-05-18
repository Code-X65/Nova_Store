const supabase = require('../config/supabase');

class AuditLogModel {
  async log({ userId, action, resourceType, resourceId, oldValues, newValues, ip, userAgent, requestId }) {
    const { data, error } = await supabase.from('audit_logs').insert([{
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
}

module.exports = new AuditLogModel();
