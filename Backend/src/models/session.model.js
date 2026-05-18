const supabase = require('../config/supabase');

class SessionModel {
  async create(userId, refreshToken, expiresAt) {
    const { data, error } = await supabase
      .from('sessions')
      .insert([{
        user_id: userId,
        refresh_token: refreshToken,
        expires_at: expiresAt,
        revoked: false
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
}

module.exports = new SessionModel();
