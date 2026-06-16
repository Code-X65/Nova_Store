const { supabaseAdmin } = require('../config/supabase');

class AdminModel {
  /**
   * Find an admin by email address.
   * @param {string} email
   * @returns {object|null} admin row or null
   */
  async findByEmail(email) {
    const { data, error } = await supabaseAdmin
      .from('admins')
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle();

    if (error) {
      console.error('[AdminModel.findByEmail] error:', error);
      throw error;
    }
    return data;
  }

  /**
   * Find an admin by ID.
   * @param {string} id
   * @returns {object|null} admin row or null
   */
  async findById(id) {
    const { data, error } = await supabaseAdmin
      .from('admins')
      .select('id, email, is_active, created_at, updated_at')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('[AdminModel.findById] error:', error);
      throw error;
    }
    return data;
  }

  /**
   * Create a new admin account.
   * @param {{ email: string, password_hash: string }} params
   * @returns {object} newly created admin row
   */
  async create({ email, password_hash }) {
    const { data, error } = await supabaseAdmin
      .from('admins')
      .insert([{ email: email.toLowerCase().trim(), password_hash }])
      .select('id, email, created_at')
      .single();

    if (error) {
      console.error('[AdminModel.create] error:', error);
      throw error;
    }
    return data;
  }

  /**
   * Update the password hash for a given admin.
   * @param {string} id
   * @param {string} password_hash
   * @returns {object} updated admin row
   */
  async updatePassword(id, password_hash) {
    const { data, error } = await supabaseAdmin
      .from('admins')
      .update({ password_hash })
      .eq('id', id)
      .select('id, email, updated_at')
      .single();

    if (error) {
      console.error('[AdminModel.updatePassword] error:', error);
      throw error;
    }
    return data;
  }

  /**
   * Return the first (and normally only) admin row — used by reset-password CLI.
   * @returns {object|null}
   */
  async findFirst() {
    const { data, error } = await supabaseAdmin
      .from('admins')
      .select('id, email')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[AdminModel.findFirst] error:', error);
      throw error;
    }
    return data;
  }

  /**
   * Increment failed login attempts for an admin.
   * If attempts reach 3 or more, lock for 60 minutes.
   * @param {object} admin
   * @returns {object} updated admin row
   */
  async incrementFailedAttempts(admin) {
    const failedAttempts = (admin.failed_login_attempts || 0) + 1;
    let lockUntil = admin.lock_until;

    if (failedAttempts >= 3) {
      lockUntil = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    }

    const { data, error } = await supabaseAdmin
      .from('admins')
      .update({
        failed_login_attempts: failedAttempts,
        lock_until: lockUntil
      })
      .eq('id', admin.id)
      .select('id, email, failed_login_attempts, lock_until')
      .single();

    if (error) {
      console.error('[AdminModel.incrementFailedAttempts] error:', error);
      throw error;
    }
    return data;
  }

  /**
   * Reset failed attempts count and lock time for an admin.
   * @param {object} admin
   * @returns {object} updated admin row
   */
  async resetFailedAttempts(admin) {
    const { data, error } = await supabaseAdmin
      .from('admins')
      .update({
        failed_login_attempts: 0,
        lock_until: null
      })
      .eq('id', admin.id)
      .select('id, email, failed_login_attempts, lock_until')
      .single();

    if (error) {
      console.error('[AdminModel.resetFailedAttempts] error:', error);
      throw error;
    }
    return data;
  }
}

module.exports = new AdminModel();
