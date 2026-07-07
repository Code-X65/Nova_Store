const supabase = require('../config/supabase');

class RoleModel {
  async findAll() {
    const { data, error } = await supabase
      .from('roles')
      .select('*, permissions:role_permissions(permissions(*))')
      .order('name', { ascending: true });

    if (error) throw error;
    return data;
  }

  async findById(id) {
    const { data, error } = await supabase
      .from('roles')
      .select('*, permissions:role_permissions(permissions(*))')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async findByName(name) {
    const { data, error } = await supabase
      .from('roles')
      .select('*, permissions:role_permissions(permissions(*))')
      .eq('name', name)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async getRoleByName(name) {
    return this.findByName(name);
  }

  async create(roleData) {
    const { data, error } = await supabase
      .from('roles')
      .insert([roleData])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async update(id, updateData) {
    const { data, error } = await supabase
      .from('roles')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async delete(id) {
    const { error } = await supabase
      .from('roles')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  }

  async assignPermissions(roleId, permissionIds) {
    // Replaces all existing assignments
    await supabase.from('role_permissions').delete().eq('role_id', roleId);

    const assignments = permissionIds.map(pId => ({
      role_id: roleId,
      permission_id: pId
    }));

    const { error } = await supabase.from('role_permissions').insert(assignments);
    if (error) throw error;
    return true;
  }
}

module.exports = new RoleModel();
