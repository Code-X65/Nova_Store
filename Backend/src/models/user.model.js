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

  async findByGoogleId(googleId) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('google_id', googleId)
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

  async create(userData) {
    let hashedPassword = null;
    if (userData.password) {
      const salt = await bcrypt.genSalt(12);
      hashedPassword = await bcrypt.hash(userData.password, salt);
    }

    const { data, error } = await supabase
      .from('users')
      .insert([{ 
        email: userData.email, 
        password_hash: hashedPassword,
        first_name: userData.firstName,
        last_name: userData.lastName,
        is_email_verified: false,
        failed_login_attempts: 0
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async update(id, updateData) {
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

  async resetFailedAttempts(user, ip = null) {
    const updateData = {
      failed_login_attempts: 0,
      lock_until: null,
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
}

module.exports = new UserModel();
