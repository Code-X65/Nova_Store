const bcrypt = require('bcrypt');
const adminModel = require('../models/admin.model');
const adminAuthLogModel = require('../models/admin-auth-log.model');

class AdminAuthService {
  /**
   * Attempt to authenticate an admin with email + password.
   *
   * On success: logs the event and returns the admin row (without password_hash).
   * On failure: logs the event and throws a generic Error so the controller
   *             can return a 401 without leaking whether the email exists.
   *
   * Rate limiting is enforced upstream by adminLoginLimiter — no lockout logic here.
   *
   * @param {string} email
   * @param {string} password   Plain-text password from the request body
   * @param {string} ip         Request IP for audit logging
   * @returns {Promise<{ id: string, email: string }>}
   */
  async login(email, password, ip) {
    const normalizedEmail = email.toLowerCase().trim();

    // Always look up the admin first — we bcrypt-compare regardless to prevent
    // timing-based email enumeration.
    const admin = await adminModel.findByEmail(normalizedEmail);

    const dummyHash = '$2b$12$invalidhashusedtopreventipenumeration000000000000000000000';
    const hashToCheck = admin ? admin.password_hash : dummyHash;

    const match = await bcrypt.compare(password, hashToCheck);

    if (!admin || !match) {
      // Fire-and-forget log (non-blocking)
      adminAuthLogModel.log({
        adminId:        null,
        ipAddress:      ip,
        emailAttempted: normalizedEmail,
        success:        false,
      });
      throw new Error('Invalid credentials');
    }

    // Successful login
    adminAuthLogModel.log({
      adminId:        admin.id,
      ipAddress:      ip,
      emailAttempted: normalizedEmail,
      success:        true,
    });

    // Return only safe fields — never expose password_hash outside this service
    return { id: admin.id, email: admin.email };
  }
}

module.exports = new AdminAuthService();
