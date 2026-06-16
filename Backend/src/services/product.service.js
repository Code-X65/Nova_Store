const productModel           = require('../models/product.model');
const variantModel           = require('../models/product-variant.model');
const productCategoryModel   = require('../models/product-category.model');
const productBrandModel      = require('../models/product-brand.model');
const slugify                = require('../utils/slug-generator');
const attributeService       = require('./attribute.service');

class ProductService {
  async createProduct(adminId, productData) {
    const { variants, attributes, ...baseData } = productData;
    
    // Validate category existence
    if (baseData.category_id) {
      const category = await productCategoryModel.findById(baseData.category_id);
      if (!category) {
        const error = new Error('Category not found');
        error.statusCode = 404;
        throw error;
      }
    }

    // Validate brand existence
    if (baseData.brand_id) {
      const brand = await productBrandModel.findById(baseData.brand_id);
      if (!brand) {
        const error = new Error('Brand not found');
        error.statusCode = 404;
        throw error;
      }
    }

    // Validate subcategory existence and hierarchy
    if (baseData.subcategory_id) {
      const subcategory = await productCategoryModel.findById(baseData.subcategory_id);
      if (!subcategory) {
        const error = new Error('Subcategory not found');
        error.statusCode = 404;
        throw error;
      }
      if (subcategory.parent_id !== baseData.category_id) {
        const error = new Error('Subcategory must be a child of the primary category');
        error.statusCode = 400;
        throw error;
      }
    }

    // Validate category-specific attributes before any DB writes
    const targetCategoryId = baseData.subcategory_id || baseData.category_id;
    if (targetCategoryId) {
      const { valid, errors } = await attributeService.validateAttributes(
        targetCategoryId,
        attributes || {},
        false // full validation — all required fields must be present
      );
      if (!valid) {
        const error = new Error(`Attribute validation failed: ${errors.join(' | ')}`);
        error.statusCode = 400;
        throw error;
      }
    }
    
    // 1. Generate Slug
    let baseSlug = baseData.slug || slugify(baseData.name);
    let slug = baseSlug;
    let attempts = 0;
    while (attempts < 10) {
      const existing = await productModel.findBySlug(slug);
      if (!existing) break;
      slug = `${baseSlug}-${Math.floor(Math.random() * 10000)}`;
      attempts++;
    }
    baseData.slug = slug;

    // 2. Calculate Discount
    if (baseData.price && baseData.sale_price) {
      baseData.discount_percentage = ((baseData.price - baseData.sale_price) / baseData.price) * 100;
    }

    // 3. Create Product row
    const product = await productModel.create({
      ...baseData,
      created_by: adminId,
      status: baseData.status || 'draft'
    });

    // 4. Persist attribute values
    const persistCategoryId = baseData.subcategory_id || baseData.category_id;
    if (persistCategoryId && attributes && Object.keys(attributes).length > 0) {
      await attributeService.saveProductAttributes(product.id, persistCategoryId, attributes);
    }

    // 5. Create Variants if any
    if (variants && variants.length > 0) {
      const variantData = variants.map(v => ({
        ...v,
        product_id: product.id
      }));
      product.variants = await variantModel.createBulk(variantData);
    }

    return product;
  }

  async getProducts(query, user) {
    const filters = {
      status:         query.status,
      category_id:    query.category_id,
      brand_id:       query.brand_id,
      subcategory_id: query.subcategory_id,
      is_featured: query.featured === 'true' ? true : undefined,
      search:      query.search,
      sortBy:      query.sortBy,
      order:       query.order,
      minPrice:    query.minPrice  ? parseFloat(query.minPrice)  : undefined,
      maxPrice:    query.maxPrice  ? parseFloat(query.maxPrice)  : undefined,
      minRating:   query.minRating ? parseFloat(query.minRating) : undefined,
      attrFilters: query.attrFilters || {} // passed from controller after parsing attr_* params
    };

    // Resolve category slug to category_id
    if (query.category && !filters.category_id) {
      const category = await productCategoryModel.findBySlug(query.category);
      if (category) {
        filters.category_id = category.id;
      } else {
        filters.category_id = '00000000-0000-0000-0000-000000000000';
      }
    }

    // Resolve brand slug to brand_id
    if (query.brand && !filters.brand_id) {
      const brand = await productBrandModel.findBySlug(query.brand);
      if (brand) {
        filters.brand_id = brand.id;
      } else {
        filters.brand_id = '00000000-0000-0000-0000-000000000000';
      }
    }

    // Resolve subcategory slug to subcategory_id
    if (query.subcategory && !filters.subcategory_id) {
      const subcategory = await productCategoryModel.findBySlug(query.subcategory);
      if (subcategory) {
        filters.subcategory_id = subcategory.id;
      } else {
        filters.subcategory_id = '00000000-0000-0000-0000-000000000000';
      }
    }

    // Non-admins only see published products
    const isAdmin = user && (user.role === 'ADMIN' || (user.roles && user.roles.includes('admin')));
    if (!isAdmin) {
      filters.status = 'published';
    }

    const pagination = {
      page:  parseInt(query.page)  || 1,
      limit: parseInt(query.limit) || 20
    };

    return await productModel.findAll(filters, pagination);
  }

  async updateProduct(productId, updateData) {
    const { attributes, ...baseUpdate } = updateData;

    // Resolve the effective category_id (from update payload or existing product)
    const existing = await productModel.findById(productId);
    let effectiveCategoryId = baseUpdate.category_id || existing?.category_id;

    if (baseUpdate.category_id) {
      const category = await productCategoryModel.findById(baseUpdate.category_id);
      if (!category) {
        const error = new Error('Category not found');
        error.statusCode = 404;
        throw error;
      }
    }

    if (baseUpdate.brand_id) {
      const brand = await productBrandModel.findById(baseUpdate.brand_id);
      if (!brand) {
        const error = new Error('Brand not found');
        error.statusCode = 404;
        throw error;
      }
    }

    // Validate subcategory and parent relationship
    let effectiveSubcategoryId = baseUpdate.subcategory_id !== undefined ? baseUpdate.subcategory_id : existing?.subcategory_id;
    if (baseUpdate.subcategory_id) {
      const subcategory = await productCategoryModel.findById(baseUpdate.subcategory_id);
      if (!subcategory) {
        const error = new Error('Subcategory not found');
        error.statusCode = 404;
        throw error;
      }
      if (subcategory.parent_id !== effectiveCategoryId) {
        const error = new Error('Subcategory must be a child of the primary category');
        error.statusCode = 400;
        throw error;
      }
    } else if (effectiveSubcategoryId && baseUpdate.category_id) {
      const subcategory = await productCategoryModel.findById(effectiveSubcategoryId);
      if (subcategory && subcategory.parent_id !== effectiveCategoryId) {
        const error = new Error('Existing subcategory is not a child of the new primary category');
        error.statusCode = 400;
        throw error;
      }
    }

    // Validate only the provided attributes (partial mode)
    const effectiveTargetCategoryId = effectiveSubcategoryId || effectiveCategoryId;
    if (effectiveTargetCategoryId && attributes && Object.keys(attributes).length > 0) {
      const { valid, errors } = await attributeService.validateAttributes(
        effectiveTargetCategoryId,
        attributes,
        true // partial update — only validate what was submitted
      );
      if (!valid) {
        const error = new Error(`Attribute validation failed: ${errors.join(' | ')}`);
        error.statusCode = 400;
        throw error;
      }
    }

    if (baseUpdate.slug || (baseUpdate.name && !baseUpdate.slug)) {
      let baseSlug = baseUpdate.slug || slugify(baseUpdate.name);
      let slug = baseSlug;
      let attempts = 0;
      while (attempts < 10) {
        const existing = await productModel.findBySlug(slug);
        if (!existing || existing.id === productId) break;
        slug = `${baseSlug}-${Math.floor(Math.random() * 10000)}`;
        attempts++;
      }
      baseUpdate.slug = slug;
    }
    
    if (baseUpdate.price && baseUpdate.sale_price) {
      baseUpdate.discount_percentage = ((baseUpdate.price - baseUpdate.sale_price) / baseUpdate.price) * 100;
    }

    const product = await productModel.update(productId, baseUpdate);

    // Upsert provided attribute values
    const updatePersistCategoryId = effectiveSubcategoryId || effectiveCategoryId;
    if (updatePersistCategoryId && attributes && Object.keys(attributes).length > 0) {
      await attributeService.saveProductAttributes(productId, updatePersistCategoryId, attributes);
    }

    return product;
  }

  async addImageToGallery(productId, imageUrl) {
    const product = await productModel.findById(productId);
    if (!product) throw new Error('Product not found');
    const gallery = product.image_gallery || [];
    gallery.push(imageUrl);
    return await productModel.update(productId, { image_gallery: gallery });
  }

  async removeImageFromGallery(productId, index) {
    const product = await productModel.findById(productId);
    if (!product) throw new Error('Product not found');
    const gallery = product.image_gallery || [];
    const idx = parseInt(index);
    if (isNaN(idx) || idx < 0 || idx >= gallery.length) {
      throw new Error('Invalid image index');
    }
    gallery.splice(idx, 1);
    return await productModel.update(productId, { image_gallery: gallery });
  }

  async updateVariant(variantId, updateData) {
    return await variantModel.update(variantId, updateData);
  }

  async deleteVariant(variantId) {
    return await variantModel.delete(variantId);
  }

  async searchProducts(query, limit = 10) {
    if (!query) throw new Error('Search query is required');
    return await productModel.search(query, limit);
  }
}

module.exports = new ProductService();
