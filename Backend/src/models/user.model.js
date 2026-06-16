const supabase = require('../config/supabase');
const bcrypt = require('bcrypt');

class UserModel {
  async findByEmail(email) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();
   
    if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
      throw error;
    }
    return data || null;
  }

  async findByPhoneNumber(phoneNumber) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('phone_number', phoneNumber)
      .single();
   
    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  }

  async findByGoogleId(googleId) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('google_id', googleId)
      .single();
   
    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  }

  async findByFacebookId(facebookId) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('facebook_id', facebookId)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  }

  async findByAppleId(appleId) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('apple_id', appleId)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  }

  async findById(id) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();
   
    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  }

  async findByReferralCode(code) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('referral_code', code.toUpperCase())
      .single();
   
    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  }

  async create(userData) {
    let hashedPassword = null;
    if (userData.password) {
      const salt = await bcrypt.genSalt(12);
      hashedPassword = await bcrypt.hash(userData.password, salt);
    }

    // Generate unique referral code if not already provided
    let referralCode = userData.referral_code;
    if (!referralCode) {
      let isUnique = false;
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      while (!isUnique) {
        referralCode = '';
        for (let i = 0; i < 12; i++) {
          referralCode += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        const { data: existingUser, error: findError } = await supabase
          .from('users')
          .select('id')
          .eq('referral_code', referralCode)
          .single();
        
        if (findError && findError.code === 'PGRST116') {
          isUnique = true;
        } else if (findError) {
          throw findError;
        }
      }
    }

    const { data, error } = await supabase
      .from('users')
      .insert([{ 
        email: userData.email, 
        password_hash: hashedPassword,
        first_name: userData.first_name,
        last_name: userData.last_name,
        phone_number: userData.phone_number || null,
        phone_country_code: userData.phone_country_code || null,
        home_address: userData.home_address ? JSON.stringify(userData.home_address) : null,
        referral_code: referralCode,
        referral_source: userData.referral_source || null,
        referral_source_other: userData.referral_source_other || null,
        referred_by: userData.referred_by || null,
        is_email_verified: false,
        is_phone_verified: userData.is_phone_verified || false,
        failed_login_attempts: 0,
        lock_until: null,
        google_id: userData.google_id || null,
        facebook_id: userData.facebook_id || null,
        apple_id: userData.apple_id || null,
        avatar_url: userData.avatar_url || null
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async update(id, updateData) {
    // If home_address is provided as an object, stringify it
    if (updateData.home_address && typeof updateData.home_address === 'object') {
      updateData.home_address = JSON.stringify(updateData.home_address);
    }
    const { data, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async comparePassword(candidatePassword, hashedPassword) {
    return await bcrypt.compare(candidatePassword, hashedPassword);
  }

  async incrementFailedAttempts(user) {
    const failedAttempts = (user.failed_login_attempts || 0) + 1;
    let lockUntil = user.lock_until;

    if (failedAttempts >= 5) {
      // Lock for 15 minutes
      lockUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    }

    return await this.update(user.id, {
      failed_login_attempts: failedAttempts,
      lock_until: lockUntil
    });
  }

  /**
   * Stricter lockout policy for admin accounts.
   * 3 failed attempts → 60-minute lockout (vs 5 attempts / 15 min for customers).
   */
  async incrementAdminFailedAttempts(user) {
    const failedAttempts = (user.failed_login_attempts || 0) + 1;
    let lockUntil = user.lock_until;

    if (failedAttempts >= 3) {
      // Lock for 60 minutes
      lockUntil = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    }

    return await this.update(user.id, {
      failed_login_attempts: failedAttempts,
      lock_until: lockUntil,
      is_locked: failedAttempts >= 3
    });
  }

  async resetFailedAttempts(user, ip = null) {
    const updateData = {
      failed_login_attempts: 0,
      lock_until: null,
      is_locked: false,
      last_login_at: new Date().toISOString()
    };
    if (ip) {
      updateData.last_login_ip = ip;
    }
    return await this.update(user.id, updateData);
  }

  async findAll(page = 1, limit = 10) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await supabase
      .from('users')
      .select('*', { count: 'exact' })
      .range(from, to)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { users: data, total: count, page, limit };
  }

  async findAdminExists() {
    const { count, error } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .in('role', ['ADMIN', 'SUPER_ADMIN']);

    if (error) throw error;
    return (count || 0) > 0;
  }
}

module.exports = new UserModel();
