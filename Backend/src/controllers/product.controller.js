const productService = require('../services/product.service');
const productModel = require('../models/product.model');
const variantModel = require('../models/product-variant.model');
const AuditService = require('../services/audit.service');
const eventBus = require('../realtime/event-bus');

class ProductController {
  async createProduct(req, res, next) {
    try {
      const product = await productService.createProduct(req.user.id, req.body, req.store?.id);
      AuditService.log(req, 'product.created', 'product', product.id, null, { name: product.name, sku: product.sku, status: product.status });
      res.status(201).json({ success: true, data: { product } });
    } catch (error) {
      next(error);
    }
  }

  async createBulkProducts(req, res, next) {
    try {
      const { products } = req.body;
      const createdProducts = await productService.createBulkProducts(req.user.id, products, req.store?.id);
      AuditService.log(req, 'product.bulk_created', 'product', null, null, { count: createdProducts.length });
      res.status(201).json({ success: true, data: { products: createdProducts } });
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

      const result = await productService.getProducts({ ...req.query, attrFilters }, req.user, req.store?.id);
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
      const product = await productModel.findById(req.params.id, req.store?.id);
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
      const oldProduct = await productModel.findById(id, req.store?.id);
      if (!oldProduct) {
        return res.status(404).json({ success: false, message: 'Product not found' });
      }
      const product = await productService.updateProduct(id, req.body, req.store?.id);
      
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
      const product = await productModel.findById(id, req.store?.id);
      if (!product) {
        return res.status(404).json({ success: false, message: 'Product not found' });
      }
      await productModel.softDelete(id);
      AuditService.log(req, 'product.deleted', 'product', id, null, { name: product.name, sku: product.sku, status: 'archived' }, {
        actionType: 'DELETE',
        severity: 'critical',
      });
      // Team alert: possible accidental catalog removal.
      eventBus.emit('catalog.product.deleted', {
        actor: req.actor || { id: req.user?.id, fullName: req.user ? `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() : null, role: req.user?.role },
        resourceType: 'product',
        resourceId: id,
        actionType: 'DELETE',
        severity: 'critical',
        title: 'Product deleted',
        message: `Product "${product.name}" (${product.sku || 'no sku'}) was deleted by ${req.actor?.fullName || 'a staff member'}.`,
        data: { productId: id, productName: product.name, sku: product.sku },
        deepLink: `/catalog/products/${id}`,
      });
      res.status(200).json({ success: true, message: 'Product archived successfully' });
    } catch (error) {
      next(error);
    }
  }

  async getProductBySlug(req, res, next) {
    try {
      const product = await productModel.findBySlug(req.params.slug, req.store?.id);
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
      const products = await productModel.getFeatured(limit, req.store?.id);
      res.status(200).json({ success: true, data: { products } });
    } catch (error) {
      next(error);
    }
  }

  async checkStock(req, res, next) {
    try {
      const productExists = await productModel.findById(req.params.id, req.store?.id);
      if (!productExists) {
        return res.status(404).json({ success: false, message: 'Product not found' });
      }
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
      const productExists = await productModel.findById(id, req.store?.id);
      if (!productExists) {
        return res.status(404).json({ success: false, message: 'Product not found' });
      }
      const product = await productService.addImageToGallery(id, imageUrl, req.store?.id);
      AuditService.log(req, 'product.image.added', 'product', id, null, { imageUrl });
      res.status(200).json({ success: true, data: { product }, message: 'Image added to gallery' });
    } catch (error) {
      next(error);
    }
  }

  async removeProductImage(req, res, next) {
    try {
      const { id, index } = req.params;
      const productExists = await productModel.findById(id, req.store?.id);
      if (!productExists) {
        return res.status(404).json({ success: false, message: 'Product not found' });
      }
      const product = await productService.removeImageFromGallery(id, index, req.store?.id);
      AuditService.log(req, 'product.image.removed', 'product', id, null, { index: parseInt(index) });
      res.status(200).json({ success: true, data: { product }, message: 'Image removed from gallery' });
    } catch (error) {
      next(error);
    }
  }

  async addProductVariant(req, res, next) {
    try {
      const { id } = req.params;
      const product = await productModel.findById(id, req.store?.id);
      if (!product) {
        return res.status(404).json({ success: false, message: 'Product not found' });
      }

      const variantData = {
        ...req.body,
        product_id: id
      };

      const variant = await variantModel.create(variantData);

      AuditService.log(req, 'product.variant.added', 'product_variant', variant.id, null, req.body);
      res.status(201).json({ success: true, data: { variant }, message: 'Variant added successfully' });
    } catch (error) {
      next(error);
    }
  }

  async updateProductVariant(req, res, next) {
    try {
      const { variantId } = req.params;
      const variantRecord = await variantModel.findById(variantId);
      if (!variantRecord) {
        return res.status(404).json({ success: false, message: 'Variant not found' });
      }
      const product = await productModel.findById(variantRecord.product_id, req.store?.id);
      if (!product) {
        return res.status(403).json({ success: false, message: 'Forbidden: Variant does not belong to this store' });
      }
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
      const variantRecord = await variantModel.findById(variantId);
      if (!variantRecord) {
        return res.status(404).json({ success: false, message: 'Variant not found' });
      }
      const product = await productModel.findById(variantRecord.product_id, req.store?.id);
      if (!product) {
        return res.status(403).json({ success: false, message: 'Forbidden: Variant does not belong to this store' });
      }
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
      const products = await productService.searchProducts(q, limit ? parseInt(limit) : 10, req.store?.id);
      res.status(200).json({ success: true, data: products });
    } catch (error) {
      next(error);
    }
  }

  async getPriceRange(req, res, next) {
    try {
      const range = await productService.getPriceRange(req.query, req.user, req.store?.id);
      res.status(200).json({ success: true, data: range });
    } catch (error) {
      next(error);
    }
  }
  async getRelatedProducts(req, res, next) {
    try {
      const { id } = req.params;
      const relatedProducts = await productService.getRelatedProducts(id, req.store?.id);
      res.status(200).json({ success: true, data: { relatedProducts } });
    } catch (error) {
      next(error);
    }
  }

  async addRelatedProduct(req, res, next) {
    try {
      const { id } = req.params;
      const { relatedProductId } = req.body;
      if (!relatedProductId) {
        return res.status(400).json({ success: false, message: 'relatedProductId is required' });
      }
      if (id === relatedProductId) {
        return res.status(400).json({ success: false, message: 'Cannot relate a product to itself' });
      }
      
      const result = await productService.addRelatedProduct(id, relatedProductId, req.store?.id);
      AuditService.log(req, 'product.related.added', 'product', id, null, { relatedProductId });
      res.status(201).json({ success: true, message: 'Related product linked successfully', data: result });
    } catch (error) {
      next(error);
    }
  }

  async removeRelatedProduct(req, res, next) {
    try {
      const { id, relatedId } = req.params;
      await productService.removeRelatedProduct(id, relatedId, req.store?.id);
      AuditService.log(req, 'product.related.removed', 'product', id, null, { relatedProductId: relatedId });
      res.status(200).json({ success: true, message: 'Related product unlinked successfully' });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ProductController();
