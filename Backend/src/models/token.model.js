const supabase = require('../config/supabase');

class TokenModel {
  // For email verification tokens
  async createVerificationToken(userId, token, expiresAt) {
    const { data, error } = await supabase
      .from('verification_tokens')
      .insert([{
        user_id: userId,
        token: token,
        expires_at: expiresAt,
        used: false
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // For password reset tokens
  async createPasswordResetToken(userId, token, expiresAt) {
    const { data, error } = await supabase
      .from('password_resets')
      .insert([{
        user_id: userId,
        token: token,
        expires_at: expiresAt,
        used: false
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async findVerificationToken(token) {
    const { data, error } = await supabase
      .from('verification_tokens')
      .select('*')
      .eq('token', token)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  }

  async findPasswordResetToken(token) {
    const { data, error } = await supabase
      .from('password_resets')
      .select('*')
      .eq('token', token)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  }

  async markVerificationTokenAsUsed(tokenId) {
    const { data, error } = await supabase
      .from('verification_tokens')
      .update({ used: true })
      .eq('id', tokenId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async markPasswordResetTokenAsUsed(tokenId) {
    const { data, error } = await supabase
      .from('password_resets')
      .update({ used: true })
      .eq('id', tokenId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}

module.exports = new TokenModel();