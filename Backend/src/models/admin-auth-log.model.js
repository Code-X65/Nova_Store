const { supabaseAdmin } = require('../config/supabase');
const logger = require('../utils/logger');

class AdminAuthLogModel {
  /**
   * Record an admin login attempt (success or failure).
   * @param {{
   *   adminId?: string,
   *   ipAddress?: string,
   *   emailAttempted: string,
   *   success: boolean,
   *   userAgent?: string,
   *   failureReason?: string
   * }} params
   */
  async log({ adminId = null, ipAddress = null, emailAttempted, success, userAgent = null, failureReason = null }) {
    const { error } = await supabaseAdmin
      .from('admin_auth_logs')
      .insert([{
        admin_id:        adminId,
        ip_address:      ipAddress,
        email_attempted: emailAttempted,
        success,
        user_agent:      userAgent,
        failure_reason:  success ? null : failureReason,
      }]);

    if (error) {
      // Log but never throw — auth logging failure must not break the auth flow
      logger.error('[AdminAuthLogModel.log] error:', { message: error.message, code: error.code });
    }
  }
}

module.exports = new AdminAuthLogModel();

