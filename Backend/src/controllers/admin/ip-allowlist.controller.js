const { supabaseAdmin } = require('../../config/supabase');
const AuditService = require('../../services/audit.service');

class IpAllowlistController {
  async list(req, res, next) {
    try {
      const { data, error } = await supabaseAdmin
        .from('admin_ip_allowlist')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      res.status(200).json({ success: true, data: data || [] });
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const { ip_cidr, label, role_scope, is_active } = req.body;
      const { data, error } = await supabaseAdmin
        .from('admin_ip_allowlist')
        .insert([{
          ip_cidr,
          label: label || null,
          role_scope: role_scope || ['STORE_OWNER', 'MANAGER', 'SUPER_ADMIN'],
          is_active: is_active ?? true,
          created_by: req.admin.id,
        }])
        .select()
        .single();

      if (error) throw error;

      AuditService.log(req, 'ip_allowlist.created', 'ip_allowlist', data.id, null, { ip_cidr, role_scope: data.role_scope });
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const { id } = req.params;
      const { ip_cidr, label, role_scope, is_active } = req.body;

      const { data: existing } = await supabaseAdmin
        .from('admin_ip_allowlist')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (!existing) {
        return res.status(404).json({ success: false, error: 'Allowlist entry not found' });
      }

      const { data, error } = await supabaseAdmin
        .from('admin_ip_allowlist')
        .update({
          ip_cidr: ip_cidr ?? existing.ip_cidr,
          label: label ?? existing.label,
          role_scope: role_scope ?? existing.role_scope,
          is_active: is_active ?? existing.is_active,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      AuditService.log(req, 'ip_allowlist.updated', 'ip_allowlist', id, existing, { ip_cidr: data.ip_cidr, role_scope: data.role_scope });
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      const { id } = req.params;
      const { data: existing } = await supabaseAdmin
        .from('admin_ip_allowlist')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (!existing) {
        return res.status(404).json({ success: false, error: 'Allowlist entry not found' });
      }

      const { error } = await supabaseAdmin
        .from('admin_ip_allowlist')
        .delete()
        .eq('id', id);

      if (error) throw error;

      AuditService.log(req, 'ip_allowlist.deleted', 'ip_allowlist', id, existing, null);
      res.status(200).json({ success: true, message: 'Entry deleted' });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new IpAllowlistController();
