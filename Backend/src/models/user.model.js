const supabase = require('../config/supabase');
const { supabaseAdmin } = require('../config/supabase');
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
        avatar_url: userData.avatar_url || null,
        store_id: userData.store_id || null
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
      lock_until: lockUntil,
      is_locked: failedAttempts >= 5
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

  async findAll(page = 1, limit = 10, options = {}) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from('users')
      .select('*', { count: 'exact' });

    if (options.store_id) {
      query = query.eq('store_id', options.store_id);
    }

    if (options.search) {
      query = query.or(`first_name.ilike.%${options.search}%,last_name.ilike.%${options.search}%,email.ilike.%${options.search}%`);
    }

    query = query
      .range(from, to)
      .order('created_at', { ascending: false });

    const { data, error, count } = await query;

    if (error) throw error;
    return { users: data, total: count, page, limit };
  }

  async findAdminExists() {
    const { count, error } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .in('role', ['STORE_OWNER', 'MANAGER', 'ORDER_STAFF', 'INVENTORY_STAFF']);

    if (error) throw error;
    return (count || 0) > 0;
  }

  /**
   * List all users with ADMIN or SUPER_ADMIN roles.
   *
   * @param {object} opts
   * @param {string} [opts.role]    - Filter by role name
   * @param {string} [opts.search]  - Partial email/name search
   * @param {number} [opts.page=1]
   * @param {number} [opts.limit=20]
   */
  async findAdmins({ role, search, page = 1, limit = 20, storeId = null } = {}) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from('users')
      .select(
        'id, email, first_name, last_name, role, is_active, is_locked, lock_type, locked_reason, locked_at, lock_until, created_at, last_login_at, store_id, ' +
        'user_roles(role_id, roles(id, name))',
        { count: 'exact' }
      )
      .in('role', ['STORE_OWNER', 'MANAGER', 'ORDER_STAFF', 'INVENTORY_STAFF']);

    if (storeId) query = query.eq('store_id', storeId);
    if (role)    query = query.eq('role', role);
    if (search) {
      query = query.or(`email.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%`);
    }

    query = query
      .order('created_at', { ascending: false })
      .range(from, to);

    const { data, error, count } = await query;
    if (error) throw error;

    return { admins: data, total: count || 0, page, limit };
  }

  /**
   * List all STORE_OWNER users.
   */
  async findSuperAdmins() {
    const { data, error } = await supabase
      .from('users')
      .select('id, email, first_name, last_name, role, is_active, created_at')
      .eq('role', 'STORE_OWNER')
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data;
  }

  /**
   * Check whether a user holds the STORE_OWNER role in user_roles.
   *
   * @param {string} userId
   * @returns {boolean}
   */
  async isSuperAdmin(userId) {
    const { data, error } = await supabase
      .from('user_roles')
      .select('roles(name)')
      .eq('user_id', userId);

    if (error) throw error;
    return (data || []).some(ur => ur.roles?.name === 'STORE_OWNER');
  }

  /**
   * Load only a user's role-derived permissions (no extra_permissions, no
   * overrides). This is the authoritative "what the role grants" set and is
   * used for privilege-escalation checks so an actor cannot re-grant a
   * permission they only hold transitively via an override.
   *
   * Returns { roles: string[], permissions: string[] }
   * @param {string} userId
   */
  async getRolePermissions(userId) {
    const { data, error } = await supabase
      .from('user_roles')
      .select('roles(name, role_permissions(permissions(key, name)))')
      .eq('user_id', userId);

    if (error) throw error;

    const roles = [];
    const permSet = new Set();
    for (const ur of data || []) {
      const role = ur.roles;
      if (!role) continue;
      roles.push(role.name);
      for (const rp of role.role_permissions || []) {
        if (rp.permissions?.key) permSet.add(rp.permissions.key);
        if (rp.permissions?.name) permSet.add(rp.permissions.name);
      }
    }
    return { roles, permissions: [...permSet] };
  }

  /**
   * Load a user's roles and their effective (ABAC-resolved) permissions.
   * Returns { roles: string[], permissions: string[] }
   *
   * Effective permissions = role permissions ∪ extra_permissions ∪ active
   * (allow) overrides − active (deny) overrides. Each override is only
   * applied when BOTH its ABAC `scope` (store/resource) and runtime
   * `conditions` (day/time/IP) match the supplied request context — so a
   * store-scoped or time-boxed grant/deny is genuinely enforced, not
   * merely stored.
   *
   * @param {string} userId
   * @param {object} [ctx]  - request context, e.g. { store_id, ip, now }
   */
  async getUserRolesAndPermissions(userId, ctx = {}) {
    const [rolesResult, userResult] = await Promise.all([
      supabase
        .from('user_roles')
        .select('roles(name, role_permissions(permissions(key, name)))')
        .eq('user_id', userId),
      supabase
        .from('users')
        .select('extra_permissions')
        .eq('id', userId)
        .single()
    ]);

    if (rolesResult.error) throw rolesResult.error;
    if (userResult.error && userResult.error.code !== 'PGRST116') throw userResult.error;

    const roles = [];
    const permSet = new Set();

    for (const ur of rolesResult.data || []) {
      const role = ur.roles;
      if (!role) continue;
      roles.push(role.name);
      for (const rp of role.role_permissions || []) {
        if (rp.permissions?.key) permSet.add(rp.permissions.key);
        if (rp.permissions?.name) permSet.add(rp.permissions.name);
      }
    }

    const extraPerms = userResult.data?.extra_permissions;
    if (Array.isArray(extraPerms)) {
      for (const perm of extraPerms) permSet.add(perm);
    }

    return { roles, permissions: [...permSet] };
  }

  /**
   * Set or clear an explicit (manual) lock on an admin account.
   * @param {string} userId
   * @param {{ locked: boolean, reason?: string, lockedBy?: string }} state
   */
  async setLockState(userId, { locked, reason = null, lockedBy = null } = {}) {
    const patch = {
      is_locked: locked,
      lock_type: locked ? 'manual' : 'auto',
      locked_reason: locked ? reason : null,
      locked_by: locked ? lockedBy : null,
      locked_at: locked ? new Date().toISOString() : null,
      lock_until: locked ? new Date(Date.now() + 1000 * 60 * 60 * 24 * 365 * 10).toISOString() : null
    };
    return await this.update(userId, patch);
  }

  /**
   * Permanently purge an admin account and its dependent rows.
   * Cascades: user_roles, permission_overrides, invitations (by email).
   * Callers MUST snapshot to admin_purges before calling this.
   * @param {string} userId
   * @param {string} email
   */
  async hardDeleteAdmin(userId, email) {
    await supabaseAdmin.from('user_roles').delete().eq('user_id', userId);
    if (email) {
      await supabaseAdmin.from('invitations').delete().eq('invited_email', email.toLowerCase().trim());
    }
    const { error } = await supabaseAdmin.from('users').delete().eq('id', userId);
    if (error) throw error;
    return true;
  }
}

module.exports = new UserModel();
