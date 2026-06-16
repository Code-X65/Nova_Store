const { supabaseAdmin } = require('../config/supabase');
const supabase = supabaseAdmin;
const crypto = require('crypto');

class PhoneVerificationModel {
  /**
   * Create a phone verification token (hashed OTP)
   * @param {UUID} userId 
   * @param {string} otp - 6-digit OTP (plaintext, will be hashed before storage)
   * @param {string} phoneNumber 
   * @param {ISOString} expiresAt 
   * @returns 
   */
  async createPhoneVerificationToken(userId, otp, phoneNumber, expiresAt) {
    // Hash the OTP for storage (SHA-256)
    const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');

    const { data, error } = await supabase
      .from('phone_verification_tokens')
      .insert([{
        user_id: userId,
        token: hashedOtp,
        phone_number: phoneNumber,
        expires_at: expiresAt,
        used: false,
        attempt_count: 0
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Find a phone verification token by the hashed OTP
   * @param {string} hashedOtp - SHA-256 hash of the OTP
   * @returns 
   */
  async findByPhoneToken(hashedOtp) {
    const { data, error } = await supabase
      .from('phone_verification_tokens')
      .select('*')
      .eq('token', hashedOtp)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  }

  /**
   * Mark the token as used
   * @param {UUID} tokenId 
   * @returns 
   */
  async markAsUsed(tokenId) {
    const { data, error } = await supabase
      .from('phone_verification_tokens')
      .update({ used: true })
      .eq('id', tokenId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Increment the attempt count for a token
   * @param {UUID} tokenId 
   * @returns 
   */
  async incrementAttemptCount(tokenId) {
    const { data: token, error: fetchError } = await supabase
      .from('phone_verification_tokens')
      .select('attempt_count')
      .eq('id', tokenId)
      .single();

    if (fetchError) throw fetchError;
    const newCount = (token.attempt_count || 0) + 1;

    const { data, error } = await supabase
      .from('phone_verification_tokens')
      .update({ attempt_count: newCount })
      .eq('id', tokenId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Reset attempt count (used when sending a new OTP)
   * @param {UUID} tokenId 
   * @returns 
   */
  async resetAttemptCount(tokenId) {
    const { data, error } = await supabase
      .from('phone_verification_tokens')
      .update({ attempt_count: 0 })
      .eq('id', tokenId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Find the latest unused token for a user (optional, for resend logic)
   * @param {UUID} userId 
   * @returns 
   */
  async findLatestByUserId(userId) {
    const { data, error } = await supabase
      .from('phone_verification_tokens')
      .select('*')
      .eq('user_id', userId)
      .eq('used', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  }
}

module.exports = new PhoneVerificationModel();