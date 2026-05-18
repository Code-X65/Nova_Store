const supabase = require('../config/supabase');

class UserRoleModel {
  async assignRole(userId, roleId, grantedBy = null) {
    const { data, error } = await supabase
      .from('user_roles')
      .upsert({
        user_id: userId,
        role_id: roleId,
        granted_by: grantedBy
      }, { onConflict: 'user_id,role_id' })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async revokeRole(userId, roleId) {
    const { error } = await supabase
      .from('user_roles')
      .delete()
      .match({ user_id: userId, role_id: roleId });

    if (error) throw error;
    return true;
  }

  async getUserRoles(userId) {
    const { data, error } = await supabase
      .from('user_roles')
      .select('role_id, roles(*)')
      .eq('user_id', userId);

    if (error) throw error;
    return data.map(ur => ur.roles);
  }

  async hasRole(userId, roleName) {
    const { data, error } = await supabase
      .from('user_roles')
      .select('roles(name)')
      .eq('user_id', userId);

    if (error) throw error;
    return data.some(ur => ur.roles.name === roleName);
  }
}

module.exports = new UserRoleModel();
