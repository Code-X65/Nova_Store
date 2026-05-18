const supabase = require('../config/supabase');

class PermissionModel {
  async findAll() {
    const { data, error } = await supabase
      .from('permissions')
      .select('*')
      .order('category', { ascending: true });

    if (error) throw error;
    return data;
  }

  async findById(id) {
    const { data, error } = await supabase
      .from('permissions')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  }

  async getUserPermissions(userId) {
    const { data, error } = await supabase
      .from('user_roles')
      .select(`
        role_id,
        roles (
          role_permissions (
            permissions (
              key
            )
          )
        )
      `)
      .eq('user_id', userId);

    if (error) throw error;

    const permissions = new Set();
    data.forEach(userRole => {
      userRole.roles.role_permissions.forEach(rp => {
        permissions.add(rp.permissions.key);
      });
    });

    return Array.from(permissions);
  }
}

module.exports = new PermissionModel();
