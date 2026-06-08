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
      .select('id, email, created_at, updated_at')
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
}

module.exports = new AdminModel();
