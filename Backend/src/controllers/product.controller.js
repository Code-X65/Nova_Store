const productService = require('../services/product.service');
const productModel = require('../models/product.model');

class ProductController {
  async createProduct(req, res, next) {
    try {
      const product = await productService.createProduct(req.user.id, req.body);
      res.status(201).json({ success: true, data: { product } });
    } catch (error) {
      next(error);
    }
  }

  async getAllProducts(req, res, next) {
    try {
      const result = await productService.getProducts(req.query, req.user);
      res.status(200).json({ 
        success: true, 
        data: { 
          products: result.products,
          pagination: {
            page: parseInt(req.query.page) || 1,
            limit: parseInt(req.query.limit) || 20,
            total: result.total,
            totalPages: Math.ceil(result.total / (parseInt(req.query.limit) || 20))
          }
        } 
      });
    } catch (error) {
      next(error);
    }
  }

  async getProductById(req, res, next) {
    try {
      const product = await productModel.findById(req.params.id);
      if (!product) {
        return res.status(404).json({ success: false, message: 'Product not found' });
      }
      res.status(200).json({ success: true, data: { product } });
    } catch (error) {
      next(error);
    }
  }

  async updateProduct(req, res, next) {
    try {
      const product = await productService.updateProduct(req.params.id, req.body);
      res.status(200).json({ success: true, data: { product } });
    } catch (error) {
      next(error);
    }
  }

  async deleteProduct(req, res, next) {
    try {
      await productModel.softDelete(req.params.id);
      res.status(200).json({ success: true, message: 'Product archived successfully' });
    } catch (error) {
      next(error);
    }
  }

  async getProductBySlug(req, res, next) {
    try {
      const product = await productModel.findBySlug(req.params.slug);
      if (!product) {
        return res.status(404).json({ success: false, message: 'Product not found' });
      }
      res.status(200).json({ success: true, data: { product } });
    } catch (error) {
      next(error);
    }
  }

  async getFeaturedProducts(req, res, next) {
    try {
      const limit = parseInt(req.query.limit) || 10;
      const products = await productModel.getFeatured(limit);
      res.status(200).json({ success: true, data: { products } });
    } catch (error) {
      next(error);
    }
  }

  async checkStock(req, res, next) {
    try {
      const product = await productModel.getStockByProductId(req.params.id);
      if (!product) {
        return res.status(404).json({ success: false, message: 'Product not found' });
      }

      const inStock = product.stock_quantity > 0;
      const lowStock = product.stock_quantity <= product.low_stock_threshold;

      res.status(200).json({ 
        success: true, 
        data: { 
          productId: product.id,
          inStock,
          stockQuantity: product.stock_quantity,
          lowStock,
          variantStock: product.variants || []
        } 
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ProductController();
