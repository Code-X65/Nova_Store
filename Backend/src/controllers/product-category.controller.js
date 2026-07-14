const categoryModel = require('../models/product-category.model');
const categoryService = require('../services/category.service');
const AuditService = require('../services/audit.service');
const eventBus = require('../realtime/event-bus');

class ProductCategoryController {
  async getAllCategories(req, res, next) {
    try {
      const { type, parentId } = req.query;

      if (type === 'tree') {
        const tree = await categoryService.getCategoryTree(req.store?.id);
        return res.status(200).json({ success: true, data: { categories: tree } });
      }

      const categories = await categoryModel.findAll({ parentId, store_id: req.store?.id });
      res.status(200).json({ success: true, data: { categories } });
    } catch (error) {
      next(error);
    }
  }

  async getCategoryById(req, res, next) {
    try {
      const category = await categoryModel.findById(req.params.id, req.store?.id);
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
      const category = await categoryModel.findBySlug(req.params.slug, req.store?.id);
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
      const category = await categoryService.createCategory(req.user.id, req.body, req.store?.id);

      res.locals.auditResource = {
        id: category.id,
        name: category.name,
        slug: category.slug,
        parent_id: category.parent_id,
        is_active: category.is_active,
        sort_order: category.sort_order
      };

      res.status(201).json({ success: true, data: { category } });
    } catch (error) {
      next(error);
    }
  }

  async createBulkCategories(req, res, next) {
    try {
      const categories = await categoryService.createBulkCategories(req.user.id, req.body, req.store?.id);

      AuditService.log(req, 'category.bulk_created', 'category', null, null, {
        count: categories.length
      }, { actionType: 'CREATE' });

      // Team alert if a large bulk operation runs (possible accidental wipe).
      const threshold = 20;
      if (categories.length >= threshold) {
        eventBus.emit('catalog.attribute.bulk_changed', {
          actor: req.actor || { id: req.user?.id, fullName: req.user ? `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() : null, role: req.user?.role },
          resourceType: 'category',
          resourceId: null,
          actionType: 'CREATE',
          severity: 'critical',
          title: 'Bulk catalog change',
          message: `${categories.length} categories were created in a single operation by ${req.actor?.fullName || 'a staff member'}.`,
          data: { count: categories.length },
          deepLink: '/catalog/categories',
        });
      }

      res.status(201).json({ success: true, data: { categories } });
    } catch (error) {
      next(error);
    }
  }

  async updateCategory(req, res, next) {
    try {
      const { id } = req.params;
      const oldCategory = await categoryModel.findById(id, req.store?.id);
      if (!oldCategory) {
        return res.status(404).json({ success: false, message: 'Category not found' });
      }
      const category = await categoryService.updateCategory(id, req.body, req.store?.id);

      req.auditBefore = oldCategory ? {
        name: oldCategory.name,
        slug: oldCategory.slug,
        parent_id: oldCategory.parent_id,
        is_active: oldCategory.is_active,
        sort_order: oldCategory.sort_order
      } : null;

      res.locals.auditResource = {
        name: category.name,
        slug: category.slug,
        parent_id: category.parent_id,
        is_active: category.is_active,
        sort_order: category.sort_order
      };

      res.status(200).json({ success: true, data: { category } });
    } catch (error) {
      next(error);
    }
  }

  async deleteCategory(req, res, next) {
    try {
      const { id } = req.params;
      const cascade = req.query.cascade === 'true';

      await categoryService.deleteCategory(id, { cascade }, req.store?.id);

      res.locals.auditResource = { id };

      res.status(200).json({ success: true, message: 'Category archived' });
    } catch (error) {
      next(error);
    }
  }

  async getSubcategories(req, res, next) {
    try {
      const { id } = req.params;
      const parentExists = await categoryModel.findById(id, req.store?.id);
      if (!parentExists) {
        return res.status(404).json({ success: false, message: 'Category not found' });
      }
      const subcategories = await categoryModel.findAll({ parentId: id, store_id: req.store?.id });
      res.status(200).json({ success: true, data: { subcategories } });
    } catch (error) {
      next(error);
    }
  }

  async reorderCategories(req, res, next) {
    try {
      const { categories } = req.body;
      if (!categories || !Array.isArray(categories)) {
        return res.status(400).json({ success: false, message: 'categories array is required' });
      }
      
      await categoryService.reorderCategories(categories, req.store?.id);
      AuditService.log(req, 'category.reordered', 'category', null, null, { count: categories.length });
      res.status(200).json({ success: true, message: 'Categories reordered successfully' });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ProductCategoryController();
