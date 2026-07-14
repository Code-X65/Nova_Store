const { supabaseAdmin } = require('../../config/supabase');
const AuditService = require('../../services/audit.service');

/**
 * Admin Session Controller
 * Works exclusively with the `admin_sessions` table managed by connect-pg-simple.
 * All identity comes from req.admin (set by requireAdmin middleware).
 */
class AdminSessionController {
  /**
   * GET /api/v1/admin/sessions
   * List all non-expired cookie sessions belonging to the current admin.
   */
  async getActiveSessions(req, res, next) {
    try {
      const adminId = req.admin.id;

      const { data, error } = await supabaseAdmin
        .from('admin_sessions')
        .select('sid, sess, expire')
        .gt('expire', new Date().toISOString())
        .order('expire', { ascending: false });

      if (error) throw error;

      const mine = (data || [])
        .filter(row => {
          try { return row.sess?.adminId === adminId; } catch { return false; }
        })
        .map(row => ({
          sessionId: row.sid,
          expiresAt: row.expire,
        }));

      res.status(200).json({ success: true, data: { sessions: mine, total: mine.length } });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/v1/admin/sessions/:sessionId
   * Revoke a specific session — only if it belongs to the current admin.
   */
  async revokeSession(req, res, next) {
    try {
      const adminId   = req.admin.id;
      const { sessionId } = req.params;

      const { data: row, error: fetchErr } = await supabaseAdmin
        .from('admin_sessions')
        .select('sid, sess')
        .eq('sid', sessionId)
        .maybeSingle();

      if (fetchErr) throw fetchErr;

      if (!row || row.sess?.adminId !== adminId) {
        return res.status(404).json({ success: false, error: 'Session not found or not yours.' });
      }

      const { error: delErr } = await supabaseAdmin
        .from('admin_sessions')
        .delete()
        .eq('sid', sessionId);

      if (delErr) throw delErr;

      AuditService.log(req, 'session.revoked', 'session', sessionId, null, { adminId });
      res.status(200).json({ success: true, message: 'Session revoked.' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/v1/admin/sessions
   * Revoke ALL sessions for the current admin (nuclear option).
   * The current session is also destroyed so the admin is immediately logged out.
   */
  async revokeAllSessions(req, res, next) {
    try {
      const adminId        = req.admin.id;
      const currentSid     = req.sessionID;

      const { data, error: fetchErr } = await supabaseAdmin
        .from('admin_sessions')
        .select('sid, sess')
        .gt('expire', new Date().toISOString());

      if (fetchErr) throw fetchErr;

      const mySids = (data || [])
        .filter(row => { try { return row.sess?.adminId === adminId; } catch { return false; } })
        .map(row => row.sid);

      if (mySids.length > 0) {
        const { error: delErr } = await supabaseAdmin
          .from('admin_sessions')
          .delete()
          .in('sid', mySids);

        if (delErr) throw delErr;
      }

      AuditService.log(req, 'session.revoked_all', 'session', null, null, { adminId, revokedCount: mySids.length });

      req.session.destroy(() => {});
      res.clearCookie('connect.sid', { path: '/' });

      res.status(200).json({
        success: true,
        message: `All ${mySids.length} admin session(s) revoked. You have been logged out.`,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/admin/sessions/health
   * Returns a global count of active (non-expired) sessions across all admins.
   */
  async getSessionHealth(req, res, next) {
    try {
      const { data, error } = await supabaseAdmin
        .from('admin_sessions')
        .select('sid, expire')
        .gt('expire', new Date().toISOString());

      if (error) throw error;

      res.status(200).json({
        success: true,
        data: {
          activeSessionsCount: data ? data.length : 0,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AdminSessionController();