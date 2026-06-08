const sessionModel = require('../models/session.model');
const logger = require('../utils/logger');

class SessionService {
  /**
   * Create a new session
   * @param {string} userId - User ID
   * @param {string} refreshToken - Hashed refresh token
   * @param {string} expiresAt - Expiration date
   * @param {boolean} isAdminSession - Whether this is an admin session
   * @returns {Object} Created session
   */
  async createSession(userId, refreshToken, expiresAt, isAdminSession = false) {
    return await sessionModel.create(userId, refreshToken, expiresAt, isAdminSession);
  }

  async findByToken(refreshToken) {
    return await sessionModel.findByToken(refreshToken);
  }

  /**
   * Find session by id
   * @param {string} sessionId - Session ID
   * @returns {Object|null} Session data
   */
  async findById(sessionId) {
    return await sessionModel.findById(sessionId);
  }

  /**
   * Revoke a session by refresh token
   * @param {string} refreshToken - Hashed refresh token
   * @returns {Object} Revoked session
   */
  async revoke(refreshToken) {
    return await sessionModel.revoke(refreshToken);
  }

  /**
   * Revoke all sessions for a user
   * @param {string} userId - User ID
   */
  async revokeAllForUser(userId) {
    await sessionModel.revokeAllForUser(userId);
  }

  /**
   * Revoke all admin sessions for a user (security feature)
   * @param {string} userId - User ID
   */
  async revokeAllAdminSessionsForUser(userId) {
    await sessionModel.revokeAllAdminSessionsForUser(userId);
  }

  /**
   * Get active sessions for a user
   * @param {string} userId - User ID
   * @returns {Array} Active sessions
   */
  async getActiveSessionsForUser(userId) {
    return await sessionModel.getActiveSessionsForUser(userId);
  }

  /**
   * Get active admin sessions for a user
   * @param {string} userId - User ID
   * @returns {Array} Active admin sessions
   */
  async getActiveAdminSessionsForUser(userId) {
    return await sessionModel.getActiveAdminSessionsForUser(userId);
  }

  /**
   * Delete expired sessions (cleanup)
   */
  async deleteExpired() {
    await sessionModel.deleteExpired();
  }
}

module.exports = new SessionService();