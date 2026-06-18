const authService = require('./auth.service');
const adminAuthLogModel = require('../models/admin-auth-log.model');
const logger = require('../utils/logger');

/** Map a thrown error message to a short reason code for the audit log. */
function resolveFailureReason(errorMessage) {
  if (!errorMessage) return 'unknown';
  const msg = errorMessage.toLowerCase();
  if (msg.includes('deactivated'))    return 'account_deactivated';
  if (msg.includes('locked'))         return 'account_locked';
  if (msg.includes('invalid') || msg.includes('password')) return 'bad_credentials';
  if (msg.includes('invitation'))     return 'no_password_set';
  return 'unknown';
}

class AdminAuthService {
  /**
   * Attempt to authenticate an admin with email + password.
   *
   * On success: logs the event (awaited) and returns the admin row.
   * On failure: logs the event (awaited) and re-throws a sanitised error.
   *
   * @param {string} email
   * @param {string} password   Plain-text password from the request body
   * @param {string} ip         Request IP for audit logging
   * @param {string} userAgent  Request User-Agent for audit logging
   * @returns {Promise<{ id: string, email: string, role: string }>}
   */
  async login(email, password, ip, userAgent) {
    const normalizedEmail = email.toLowerCase().trim();

    try {
      const { user } = await authService.adminLogin(normalizedEmail, password, ip);

      // Successful login — awaited so the record is guaranteed before we return
      try {
        await adminAuthLogModel.log({
          adminId:        user.id,
          ipAddress:      ip,
          emailAttempted: normalizedEmail,
          success:        true,
          userAgent:      userAgent,
        });
      } catch (logErr) {
        // Log failure must never block the successful auth response
        logger.error('[AdminAuthService] Failed to write success auth log:', logErr.message);
      }

      return { id: user.id, email: user.email, role: user.role };
    } catch (error) {
      const failureReason = resolveFailureReason(error.message);

      // Failed login — awaited so the record lands before the error propagates
      try {
        await adminAuthLogModel.log({
          adminId:        null,
          ipAddress:      ip,
          emailAttempted: normalizedEmail,
          success:        false,
          failureReason:  failureReason,
          userAgent:      userAgent,
        });
      } catch (logErr) {
        logger.error('[AdminAuthService] Failed to write failure auth log:', logErr.message);
      }

      // Map authService errors to keep controller compatibility
      if (error.message.includes('deactivated')) {
        throw new Error('Account deactivated');
      }
      if (error.message.includes('locked')) {
        throw new Error('Account locked');
      }
      if (error.message.includes('Invalid') || error.statusCode === 401) {
        throw new Error('Invalid credentials');
      }
      throw error;
    }
  }
}

module.exports = new AdminAuthService();
