const categoryModel = require('../models/product-category.model');
const categoryService = require('../services/category.service');
const AuditService = require('../services/audit.service');

class ProductCategoryController {
  async getAllCategories(req, res, next) {
    try {
      const { type, parentId } = req.query;

      if (type === 'tree') {
        const tree = await categoryService.getCategoryTree();
        return res.status(200).json({ success: true, data: { categories: tree } });
      }

      const categories = await categoryModel.findAll({ parentId });
      res.status(200).json({ success: true, data: { categories } });
    } catch (error) {
      next(error);
    }
  }

  async getCategoryById(req, res, next) {
    try {
      const category = await categoryModel.findById(req.params.id);
      if (!category) {
        return res.status(404).json({ success: false, message: 'Category not found' });
      }
      res.status(200).json({ success: true, data: { category } });
    } catch (error) {
      next(error);
    }
  }

  async getCategoryBySlug(req, res, next) {
    try {
      const category = await categoryModel.findBySlug(req.params.slug);
      if (!category) {
        return res.status(404).json({ success: false, message: 'Category not found' });
      }
      res.status(200).json({ success: true, data: { category } });
    } catch (error) {
      next(error);
    }
  }

  async createCategory(req, res, next) {
    try {
      const category = await categoryService.createCategory(req.user.id, req.body);

      AuditService.log(req, 'category.created', 'category', category.id, null, {
        name: category.name,
        slug: category.slug,
        parent_id: category.parent_id,
        is_active: category.is_active,
        sort_order: category.sort_order
      });

      res.status(201).json({ success: true, data: { category } });
    } catch (error) {
      next(error);
    }
  }

  async createBulkCategories(req, res, next) {
    try {
      const categories = await categoryService.createBulkCategories(req.user.id, req.body);

      AuditService.log(req, 'category.bulk_created', 'category', null, null, {
        count: categories.length
      });

      res.status(201).json({ success: true, data: { categories } });
    } catch (error) {
      next(error);
    }
  }

  async updateCategory(req, res, next) {
    try {
      const { id } = req.params;
      const oldCategory = await categoryModel.findById(id);
      const category = await categoryService.updateCategory(id, req.body);

      const oldValues = oldCategory ? {
        name: oldCategory.name,
        slug: oldCategory.slug,
        parent_id: oldCategory.parent_id,
        is_active: oldCategory.is_active,
        sort_order: oldCategory.sort_order
      } : null;

      const newValues = {
        name: category.name,
        slug: category.slug,
        parent_id: category.parent_id,
        is_active: category.is_active,
        sort_order: category.sort_order
      };

      AuditService.log(req, 'category.updated', 'category', id, oldValues, newValues);
      res.status(200).json({ success: true, data: { category } });
    } catch (error) {
      next(error);
    }
  }

  async deleteCategory(req, res, next) {
    try {
      const { id } = req.params;
      const cascade = req.query.cascade === 'true';

      await categoryService.deleteCategory(id, { cascade });
      AuditService.log(req, 'category.deleted', 'category', id);
      res.status(200).json({ success: true, message: 'Category archived' });
    } catch (error) {
      next(error);
    }
  }

  async getSubcategories(req, res, next) {
    try {
      const { id } = req.params;
      const subcategories = await categoryModel.findAll({ parentId: id });
      res.status(200).json({ success: true, data: { subcategories } });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ProductCategoryController();
