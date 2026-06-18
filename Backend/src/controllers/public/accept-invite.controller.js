const invitationService = require('../../services/invitation.service');
const logger = require('../../utils/logger');

/**
 * AcceptInviteController — Public (no auth required)
 *
 * Handles the invitation acceptance flow:
 *   GET  /api/v1/accept-invite/:token  → validate token, return metadata
 *   POST /api/v1/accept-invite/:token  → create account, mark accepted
 */
class AcceptInviteController {
  /**
   * GET /api/v1/accept-invite/:token
   *
   * Validate the token and return safe metadata for the acceptance form.
   * Does NOT return the token itself.
   *
   * Response: { success: true, data: { email, roleName, expiresAt } }
   */
  async getInviteInfo(req, res, next) {
    try {
      const { token } = req.params;
      const info = await invitationService.validateInvitationToken(token);
      return res.json({ success: true, data: info });
    } catch (err) {
      // Return generic message to prevent email enumeration
      if (err.statusCode === 400) {
        return res.status(400).json({
          success: false,
          error: 'Invalid or expired invitation link.'
        });
      }
      next(err);
    }
  }

  /**
   * POST /api/v1/accept-invite/:token
   *
   * Accept the invitation: create user account, assign role.
   *
   * Body: { password: string, firstName: string, lastName: string }
   * Response: { success: true, message: 'Account created. You can now log in.' }
   */
  async acceptInvite(req, res, next) {
    try {
      const { token } = req.params;
      const { password, firstName, lastName } = req.body;

      if (!password || !firstName || !lastName) {
        return res.status(400).json({
          success: false,
          error: 'password, firstName, and lastName are required.'
        });
      }

      if (password.length < 8) {
        return res.status(400).json({
          success: false,
          error: 'Password must be at least 8 characters long.'
        });
      }

      const user = await invitationService.acceptInvitation(token, {
        password,
        firstName,
        lastName
      });

      logger.info(`[AcceptInvite] New admin account created: ${user.email}`);

      return res.status(201).json({
        success: true,
        message: 'Account created successfully. You can now log in.',
        data: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role
        }
      });
    } catch (err) {
      if (err.statusCode === 400) {
        return res.status(400).json({
          success: false,
          error: 'Invalid or expired invitation link.'
        });
      }
      next(err);
    }
  }
}

module.exports = new AcceptInviteController();
