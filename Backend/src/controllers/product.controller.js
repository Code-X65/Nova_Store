const productService = require('../services/product.service');
const productModel = require('../models/product.model');
const AuditService = require('../services/audit.service');

class ProductController {
  async createProduct(req, res, next) {
    try {
      const product = await productService.createProduct(req.user.id, req.body);
      AuditService.log(req, 'product.created', 'product', product.id, null, { name: product.name, sku: product.sku, status: product.status });
      res.status(201).json({ success: true, data: { product } });
    } catch (error) {
      next(error);
    }
  }

  async getAllProducts(req, res, next) {
    try {
      // Parse attr_* query params into { RAM: '8GB', Storage: '256GB' } etc.
      const attrFilters = {};
      for (const [key, val] of Object.entries(req.query)) {
        if (key.startsWith('attr_')) {
          const attrName = key.slice(5); // strip 'attr_' prefix
          attrFilters[attrName] = val;
        }
      }

      const result = await productService.getProducts({ ...req.query, attrFilters }, req.user);
      res.status(200).json({ 
        success: true, 
        data: { 
          products: result.products,
          pagination: {
            page: result.pagination?.page || parseInt(req.query.page) || 1,
            limit: result.pagination?.limit || parseInt(req.query.limit) || 20,
            total: result.pagination?.total || 0,
            totalPages: result.pagination?.totalPages || 0
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
      const { id } = req.params;
      const oldProduct = await productModel.findById(id);
      const product = await productService.updateProduct(id, req.body);
      
      const oldValues = oldProduct ? { name: oldProduct.name, sku: oldProduct.sku, status: oldProduct.status } : null;
      const newValues = { name: product.name, sku: product.sku, status: product.status };
      
      AuditService.log(req, 'product.updated', 'product', id, oldValues, newValues);
      res.status(200).json({ success: true, data: { product } });
    } catch (error) {
      next(error);
    }
  }

  async deleteProduct(req, res, next) {
    try {
      const { id } = req.params;
      await productModel.softDelete(id);
      AuditService.log(req, 'product.deleted', 'product', id);
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

  async addProductImage(req, res, next) {
    try {
      const { id } = req.params;
      const { imageUrl } = req.body;
      if (!imageUrl) {
        return res.status(400).json({ success: false, message: 'imageUrl is required' });
      }
      const product = await productService.addImageToGallery(id, imageUrl);
      AuditService.log(req, 'product.image.added', 'product', id, null, { imageUrl });
      res.status(200).json({ success: true, data: { product }, message: 'Image added to gallery' });
    } catch (error) {
      next(error);
    }
  }

  async removeProductImage(req, res, next) {
    try {
      const { id, index } = req.params;
      const product = await productService.removeImageFromGallery(id, index);
      AuditService.log(req, 'product.image.removed', 'product', id, null, { index: parseInt(index) });
      res.status(200).json({ success: true, data: { product }, message: 'Image removed from gallery' });
    } catch (error) {
      next(error);
    }
  }

  async updateProductVariant(req, res, next) {
    try {
      const { variantId } = req.params;
      const variant = await productService.updateVariant(variantId, req.body);
      AuditService.log(req, 'product.variant.updated', 'product_variant', variantId, null, req.body);
      res.status(200).json({ success: true, data: { variant }, message: 'Variant updated successfully' });
    } catch (error) {
      next(error);
    }
  }

  async deleteProductVariant(req, res, next) {
    try {
      const { variantId } = req.params;
      await productService.deleteVariant(variantId);
      AuditService.log(req, 'product.variant.deleted', 'product_variant', variantId);
      res.status(200).json({ success: true, message: 'Variant deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  async search(req, res, next) {
    try {
      const { q, limit } = req.query;
      const products = await productService.searchProducts(q, limit ? parseInt(limit) : 10);
      res.status(200).json({ success: true, data: products });
    } catch (error) {
      next(error);
    }
  }

  async getPriceRange(req, res, next) {
    try {
      const range = await productService.getPriceRange(req.query, req.user);
      res.status(200).json({ success: true, data: range });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ProductController();
