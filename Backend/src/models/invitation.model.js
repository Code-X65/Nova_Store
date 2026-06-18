const crypto = require('crypto');
const { supabaseAdmin } = require('../config/supabase');

/**
 * InvitationModel
 *
 * All DB interactions for the invitations table.
 * Uses supabaseAdmin (service-role key) so RLS is bypassed.
 */
class InvitationModel {
  /**
   * Create a new pending invitation.
   *
   * @param {object} params
   * @param {string} params.email         - Invited email address
   * @param {string} params.roleId        - UUID of the role to assign
   * @param {string[]} params.permissions - Extra permission slugs (optional)
   * @param {string} params.invitedBy     - UUID of the SuperAdmin who sent the invite
   * @param {Date}   params.expiresAt     - Expiry date/time
   * @returns {object} Created invitation record
   */
  async create({ email, roleId, permissions = [], invitedBy, expiresAt }) {
    // 64-char hex token (32 random bytes → 256 bits of entropy)
    const token = crypto.randomBytes(32).toString('hex');

    const { data, error } = await supabaseAdmin
      .from('invitations')
      .insert([{
        email: email.toLowerCase().trim(),
        token,
        role_id: roleId,
        permissions: permissions,
        invited_by: invitedBy,
        expires_at: expiresAt instanceof Date ? expiresAt.toISOString() : expiresAt,
        status: 'pending'
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Look up an invitation by its raw token.
   *
   * @param {string} token - 64-char hex token
   * @returns {object|null}
   */
  async findByToken(token) {
    const { data, error } = await supabaseAdmin
      .from('invitations')
      .select('*, roles(id, name, description)')
      .eq('token', token)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  }

  /**
   * Find the most recent pending invitation for a given email.
   *
   * @param {string} email
   * @returns {object|null}
   */
  async findPendingByEmail(email) {
    const { data, error } = await supabaseAdmin
      .from('invitations')
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  }

  /**
   * Mark an invitation as accepted and record when + by whom.
   *
   * @param {string} token  - 64-char hex token
   * @param {string} userId - UUID of the newly created user account
   * @returns {object} Updated invitation record
   */
  async accept(token, userId) {
    const { data, error } = await supabaseAdmin
      .from('invitations')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
        accepted_by: userId
      })
      .eq('token', token)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Revoke a pending invitation.
   *
   * @param {string} invitationId - UUID of the invitation
   * @returns {object} Updated record
   */
  async revoke(invitationId) {
    const { data, error } = await supabaseAdmin
      .from('invitations')
      .update({ status: 'revoked' })
      .eq('id', invitationId)
      .eq('status', 'pending') // Only revoke pending ones
      .select()
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  }

  /**
   * Extend the expiry and re-activate a previously sent invitation.
   *
   * @param {string} invitationId - UUID of the invitation
   * @param {Date}   newExpiresAt - New expiry timestamp
   * @returns {object} Updated record
   */
  async resend(invitationId, newExpiresAt) {
    const { data, error } = await supabaseAdmin
      .from('invitations')
      .update({
        expires_at: newExpiresAt instanceof Date ? newExpiresAt.toISOString() : newExpiresAt,
        status: 'pending'
      })
      .eq('id', invitationId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Paginated list of invitations.
   *
   * @param {object} filters
   * @param {string} [filters.status]     - Filter by status
   * @param {string} [filters.search]     - Partial email search
   * @param {string} [filters.invitedBy]  - Filter by inviter user_id
   * @param {number} [filters.page=1]
   * @param {number} [filters.limit=20]
   * @returns {{ invitations: object[], total: number, page: number, limit: number }}
   */
  async list({ status, search, invitedBy, page = 1, limit = 20 } = {}) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabaseAdmin
      .from('invitations')
      .select(
        '*, roles(id, name), inviter:invited_by(id, email, first_name, last_name)',
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(from, to);

    if (status) query = query.eq('status', status);
    if (invitedBy) query = query.eq('invited_by', invitedBy);
    if (search) query = query.ilike('email', `%${search}%`);

    const { data, error, count } = await query;
    if (error) throw error;

    return {
      invitations: data,
      total: count || 0,
      page,
      limit
    };
  }

  /**
   * Find a single invitation by its UUID (for get/revoke/resend by id).
   *
   * @param {string} id - UUID
   * @returns {object|null}
   */
  async findById(id) {
    const { data, error } = await supabaseAdmin
      .from('invitations')
      .select('*, roles(id, name, description)')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  }

  /**
   * Expire all pending invitations whose expires_at < now().
   * Called by the cleanup cron job.
   *
   * @returns {number} Count of expired records
   */
  async expireStale() {
    const { data, error } = await supabaseAdmin
      .from('invitations')
      .update({ status: 'expired' })
      .eq('status', 'pending')
      .lt('expires_at', new Date().toISOString())
      .select('id');

    if (error) throw error;
    return (data || []).length;
  }
}

module.exports = new InvitationModel();
