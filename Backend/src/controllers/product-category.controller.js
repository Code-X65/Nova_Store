const categoryModel = require('../models/product-category.model');
const categoryService = require('../services/category.service');

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

  async createCategory(req, res, next) {
    try {
      const category = await categoryService.createCategory(req.user.id, req.body);
      res.status(201).json({ success: true, data: { category } });
    } catch (error) {
      next(error);
    }
  }

  async updateCategory(req, res, next) {
    try {
      const category = await categoryModel.update(req.params.id, req.body);
      res.status(200).json({ success: true, data: { category } });
    } catch (error) {
      next(error);
    }
  }

  async deleteCategory(req, res, next) {
    try {
      // Check if category has subcategories
      const children = await categoryModel.findAll({ parentId: req.params.id });
      if (children.length > 0) {
        const error = new Error('Cannot delete category with subcategories');
        error.statusCode = 409;
        throw error;
      }

      await categoryModel.softDelete(req.params.id);
      res.status(200).json({ success: true, message: 'Category archived' });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ProductCategoryController();
