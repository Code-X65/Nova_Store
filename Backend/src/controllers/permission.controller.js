const permissionModel = require('../models/permission.model');
const supabase = require('../config/supabase');
const Joi = require('joi');

const listSchema = {
  query: Joi.object({
    category: Joi.string().optional(),
    search:   Joi.string().optional(),
    page:     Joi.number().integer().min(1).optional(),
    limit:    Joi.number().integer().min(1).max(100).optional()
  })
};

class PermissionController {
  async getAllPermissions(req, res, next) {
    try {
      const { category, search, page = 1, limit = 100 } = req.query;

      let query = supabase
        .from('permissions')
        .select('*', { count: 'exact' })
        .order('category', { ascending: true })
        .order('name', { ascending: true });

      if (category) query = query.eq('category', category);
      if (search) query = query.or(`key.ilike.%${search}%,name.ilike.%${search}%`);

      const offset = (parseInt(page) - 1) * parseInt(limit);
      query = query.range(offset, offset + parseInt(limit) - 1);

      const { data, count, error } = await query;
      if (error) throw error;

      res.status(200).json({
        success: true,
        data: {
          permissions: data,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: count || 0,
            totalPages: Math.ceil((count || 0) / parseInt(limit))
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async getPermissionCategories(req, res, next) {
    try {
      const { data, error } = await supabase
        .from('permissions')
        .select('category')
        .not('category', 'is', null)
        .order('category', { ascending: true });

      if (error) throw error;

      const categories = [...new Set((data || []).map(r => r.category))];
      res.status(200).json({ success: true, data: { categories } });
    } catch (error) {
      next(error);
    }
  }

  async getPermissionById(req, res, next) {
    try {
      const permission = await permissionModel.findById(req.params.id);
      if (!permission) {
        return res.status(404).json({ success: false, message: 'Permission not found' });
      }
      res.status(200).json({ success: true, data: { permission } });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new PermissionController();
