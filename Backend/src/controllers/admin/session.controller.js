const sessionService = require('../../services/session.service');

class AdminSessionController {
  /**
   * Get active sessions for the current admin user
   * GET /admin/sessions
   */
  async getActiveSessions(req, res, next) {
    try {
      const userId = req.user.id;
      const sessions = await sessionService.getActiveSessionsForUser(userId);
      const adminSessions = await sessionService.getActiveAdminSessionsForUser(userId);
      
      res.status(200).json({
        success: true,
        data: {
          allSessions: sessions,
          adminSessions: adminSessions
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Revoke a specific session
   * DELETE /admin/sessions/:sessionId
   */
  async revokeSession(req, res, next) {
    try {
      const { sessionId } = req.params;
      const userId = req.user.id;
      
      // Verify the session belongs to the user before revoking
      const session = await sessionService.findById(sessionId);
      if (!session || session.user_id !== userId) {
        const error = new Error('Session not found or unauthorized');
        error.statusCode = 404;
        throw error;
      }
      
      await sessionService.revoke(session.refresh_token);
      
      res.status(200).json({
        success: true,
        message: 'Session revoked successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Revoke all admin sessions for the current user (security feature)
   * DELETE /admin/sessions
   */
  async revokeAllAdminSessions(req, res, next) {
    try {
      const userId = req.user.id;
      await sessionService.revokeAllAdminSessionsForUser(userId);
      
      res.status(200).json({
        success: true,
        message: 'All admin sessions revoked successfully'
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AdminSessionController();