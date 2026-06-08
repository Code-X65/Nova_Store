const { supabaseAdmin } = require('../config/supabase');

class AdminAuthLogModel {
  /**
   * Record an admin login attempt (success or failure).
   * @param {{ adminId?: string, ipAddress?: string, emailAttempted: string, success: boolean }} params
   */
  async log({ adminId = null, ipAddress = null, emailAttempted, success }) {
    const { error } = await supabaseAdmin
      .from('admin_auth_logs')
      .insert([{
        admin_id:        adminId,
        ip_address:      ipAddress,
        email_attempted: emailAttempted,
        success,
      }]);

    if (error) {
      // Log but never throw — auth logging failure must not break the auth flow
      console.error('[AdminAuthLogModel.log] error:', error);
    }
  }
}

module.exports = new AdminAuthLogModel();
