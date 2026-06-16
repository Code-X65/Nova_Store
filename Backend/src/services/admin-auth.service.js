const bcrypt = require('bcrypt');
const adminModel = require('../models/admin.model');
const adminAuthLogModel = require('../models/admin-auth-log.model');

class AdminAuthService {
  /**
   * Attempt to authenticate an admin with email + password.
   *
   * On success: logs the event and returns the admin row (without password_hash).
   * On failure: logs the event and throws a generic Error or specific lockout/deactivation errors.
   *
   * @param {string} email
   * @param {string} password   Plain-text password from the request body
   * @param {string} ip         Request IP for audit logging
   * @param {string} userAgent  Request User-Agent for audit logging
   * @returns {Promise<{ id: string, email: string }>}
   */
  async login(email, password, ip, userAgent) {
    const normalizedEmail = email.toLowerCase().trim();

    // Always look up the admin first
    const admin = await adminModel.findByEmail(normalizedEmail);

    if (admin) {
      if (!admin.is_active) {
        throw new Error('Account deactivated');
      }

      if (admin.lock_until && new Date(admin.lock_until) > new Date()) {
        throw new Error('Account locked');
      }
    }

    const dummyHash = '$2b$12$invalidhashusedtopreventipenumeration000000000000000000000';
    const hashToCheck = admin ? admin.password_hash : dummyHash;

    const match = await bcrypt.compare(password, hashToCheck);

    if (!admin || !match) {
      if (admin) {
        await adminModel.incrementFailedAttempts(admin);
      }

      // Fire-and-forget log (non-blocking)
      adminAuthLogModel.log({
        adminId:        null,
        ipAddress:      ip,
        emailAttempted: normalizedEmail,
        success:        false,
        userAgent:      userAgent,
      });
      throw new Error('Invalid credentials');
    }

    // Successful login - reset failed attempts
    await adminModel.resetFailedAttempts(admin);

    adminAuthLogModel.log({
      adminId:        admin.id,
      ipAddress:      ip,
      emailAttempted: normalizedEmail,
      success:        true,
      userAgent:      userAgent,
    });

    // Return only safe fields — never expose password_hash outside this service
    return { id: admin.id, email: admin.email };
  }
}

module.exports = new AdminAuthService();
