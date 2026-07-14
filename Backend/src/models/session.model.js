const supabase = require('../config/supabase');

class SessionModel {
  /**
   * @param {string}  userId
   * @param {string}  refreshToken - already hashed (SHA-256 hex)
   * @param {string}  expiresAt    - ISO timestamp string
   * @param {boolean} [isAdmin]    - flag admin sessions for shorter TTL / concurrent-cap tracking
   */
  async create(userId, refreshToken, expiresAt, isAdmin = false, deviceFingerprint = null, userAgent = null, ipAddress = null) {
    const { data, error } = await supabase
      .from('sessions')
      .insert([{
        user_id: userId,
        refresh_token: refreshToken,
        expires_at: expiresAt,
        revoked: false,
        is_admin: isAdmin,
        device_fingerprint: deviceFingerprint,
        user_agent: userAgent,
        ip_address: ipAddress
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async findByToken(refreshToken) {
    const { data, error } = await supabase
      .from('sessions')
      .select('*, users(*)')
      .eq('refresh_token', refreshToken)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  }

  async findById(sessionId) {
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  }

  async revoke(refreshToken) {
    const { data, error } = await supabase
      .from('sessions')
      .update({ revoked: true })
      .eq('refresh_token', refreshToken)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async revokeById(sessionId) {
    const { data, error } = await supabase
      .from('sessions')
      .update({ revoked: true })
      .eq('id', sessionId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async revokeAllForUser(userId) {
    const { error } = await supabase
      .from('sessions')
      .update({ revoked: true })
      .eq('user_id', userId);

    if (error) throw error;
  }

  async deleteExpired() {
    const { error } = await supabase
      .from('sessions')
      .delete()
      .lt('expires_at', new Date().toISOString());

    if (error) throw error;
  }

  // ─── Admin session helpers ──────────────────────────────────────────────────

  /**
   * Count active (non-revoked, non-expired) admin sessions for a user.
   * Used to enforce the concurrent admin session cap (default: 3).
   */
  async countActiveAdminSessions(userId) {
    const { count, error } = await supabase
      .from('sessions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_admin', true)
      .eq('revoked', false)
      .gt('expires_at', new Date().toISOString());

    if (error) throw error;
    return count || 0;
  }

  /**
   * Revoke the oldest active admin session for a user.
   * Called when the concurrent session cap is exceeded.
   */
  async revokeOldestAdminSession(userId) {
    const { data: oldest, error: findError } = await supabase
      .from('sessions')
      .select('id')
      .eq('user_id', userId)
      .eq('is_admin', true)
      .eq('revoked', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (findError && findError.code !== 'PGRST116') throw findError;
    if (!oldest) return null;

    return await this.revokeById(oldest.id);
  }

  /**
   * List all active (non-revoked, non-expired) sessions for a user.
   * Used by the admin session-management endpoint (GET /admin/auth/sessions).
   */
  async findActiveSessionsForUser(userId) {
    const { data, error } = await supabase
      .from('sessions')
      .select('id, created_at, expires_at, is_admin')
      .eq('user_id', userId)
      .eq('revoked', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async getActiveSessionsForUser(userId) {
    return await this.findActiveSessionsForUser(userId);
  }

  async getActiveAdminSessionsForUser(userId) {
    const { data, error } = await supabase
      .from('sessions')
      .select('id, created_at, expires_at, is_admin')
      .eq('user_id', userId)
      .eq('is_admin', true)
      .eq('revoked', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async revokeAllAdminSessionsForUser(userId) {
    const { error } = await supabase
      .from('sessions')
      .update({ revoked: true })
      .eq('user_id', userId)
      .eq('is_admin', true);

    if (error) throw error;
  }
}

module.exports = new SessionModel();
