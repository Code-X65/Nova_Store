const productModel           = require('../models/product.model');
const variantModel           = require('../models/product-variant.model');
const productCategoryModel   = require('../models/product-category.model');
const productBrandModel      = require('../models/product-brand.model');
const slugify                = require('../utils/slug-generator');
const attributeService       = require('./attribute.service');
const { SINGLE_STORE_ID }    = require('../config/store');

// Only a positive sale_price strictly below price counts as a real discount —
// otherwise (sale_price cleared, or >= price) the discount is 0, not stale/negative.
function computeDiscountPercentage(price, salePrice) {
  if (!price || !salePrice || salePrice >= price) return 0;
  return ((price - salePrice) / price) * 100;
}

// products.dimensions is a JSONB {length,width,height} column; the admin UI submits
// flat dimensions_length/width/height fields instead, so fold them in before persisting.
function foldDimensions(baseData) {
  const { dimensions_length, dimensions_width, dimensions_height, ...rest } = baseData;
  if (dimensions_length === undefined && dimensions_width === undefined && dimensions_height === undefined) {
    return rest;
  }
  rest.dimensions = {
    ...(rest.dimensions || {}),
    ...(dimensions_length !== undefined && { length: dimensions_length }),
    ...(dimensions_width !== undefined && { width: dimensions_width }),
    ...(dimensions_height !== undefined && { height: dimensions_height })
  };
  return rest;
}

class ProductService {
  async createProduct(adminId, productData) {
    const { variants, attributes, ...rawBaseData } = productData;
    const baseData = foldDimensions(rawBaseData);

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
    
    // Extract related product ids so they aren't passed to the main table insert
    const relatedIds = baseData.related_product_ids || [];
    delete baseData.related_product_ids;
    
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
    baseData.discount_percentage = computeDiscountPercentage(baseData.price, baseData.sale_price);

    // 3. Create Product row
    baseData.store_id = SINGLE_STORE_ID;

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

    // 6. Add related products
    if (relatedIds.length > 0) {
      for (const rId of relatedIds) {
        try {
          await productModel.addRelatedProduct(product.id, rId, SINGLE_STORE_ID);
        } catch (err) {
          // ignore duplicate errors or invalid relations to allow product creation to succeed
          console.warn(`Failed to link related product ${rId}:`, err.message);
        }
      }
      product.related_product_ids = relatedIds;
    }

    return product;
  }

  async createBulkProducts(adminId, productsData) {
    const created = [];
    const errors = [];
    
    // We execute sequentially to ensure validation and slugs are handled properly without race conditions
    for (let i = 0; i < productsData.length; i++) {
      try {
        const product = await this.createProduct(adminId, productsData[i]);
        created.push(product);
      } catch (err) {
        errors.push({ index: i, sku: productsData[i].sku, error: err.message });
      }
    }

    if (errors.length > 0 && created.length === 0) {
      const error = new Error(`Bulk creation failed. First error: ${errors[0].error}`);
      error.statusCode = 400;
      error.details = errors;
      throw error;
    }

    return created;
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
      attrFilters: query.attrFilters || {}, // passed from controller after parsing attr_* params
      store_id:    SINGLE_STORE_ID
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
    const adminRoles = ['ADMIN', 'admin', 'STORE_OWNER', 'MANAGER', 'STAFF'];
    const isAdmin = user && (
      adminRoles.includes(user.role) || 
      (user.roles && user.roles.some(r => adminRoles.includes(r))) ||
      (user.permissions && user.permissions.includes('admin:access'))
    );
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
    const { attributes, ...rawBaseUpdate } = updateData;
    const baseUpdate = foldDimensions(rawBaseUpdate);

    // Resolve the effective category_id (from update payload or existing product)
    const existing = await productModel.findById(productId, SINGLE_STORE_ID);
    if (!existing) {
      const error = new Error('Product not found');
      error.statusCode = 404;
      throw error;
    }

    // A direct stock_quantity edit bypasses the atomic reservation RPCs
    // (reserve_stock_increment/commit_reserved_stock) entirely — the DB CHECK
    // constraint only guards stock_quantity >= 0 individually, not against
    // outstanding reserved_quantity, so this could otherwise set stock below
    // what's already held for pending checkouts (negative "available" stock).
    if (baseUpdate.stock_quantity !== undefined) {
      const reserved = existing.reserved_quantity || 0;
      if (baseUpdate.stock_quantity < reserved) {
        const error = new Error(`Cannot set stock_quantity (${baseUpdate.stock_quantity}) below the ${reserved} unit(s) already reserved for pending checkouts.`);
        error.statusCode = 400;
        throw error;
      }
    }

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
    
    // Recalculate whenever EITHER price or sale_price changes — not just when both
    // are present in the same payload — using the existing row as fallback for
    // whichever field wasn't submitted. This also correctly zeroes the discount
    // back out when a sale ends (sale_price cleared to null).
    if (baseUpdate.price !== undefined || baseUpdate.sale_price !== undefined) {
      const effectivePrice = baseUpdate.price !== undefined ? baseUpdate.price : existing?.price;
      const effectiveSalePrice = baseUpdate.sale_price !== undefined ? baseUpdate.sale_price : existing?.sale_price;
      baseUpdate.discount_percentage = computeDiscountPercentage(effectivePrice, effectiveSalePrice);
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
    const product = await productModel.findById(productId, SINGLE_STORE_ID);
    if (!product) throw new Error('Product not found');
    const gallery = product.image_gallery || [];
    gallery.push(imageUrl);
    return await productModel.update(productId, { image_gallery: gallery });
  }

  async removeImageFromGallery(productId, index) {
    const product = await productModel.findById(productId, SINGLE_STORE_ID);
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
    if (updateData.stock_quantity !== undefined) {
      const existingVariant = await variantModel.findById(variantId);
      if (!existingVariant) {
        const error = new Error('Variant not found');
        error.statusCode = 404;
        throw error;
      }
      const reserved = existingVariant.reserved_quantity || 0;
      if (updateData.stock_quantity < reserved) {
        const error = new Error(`Cannot set stock_quantity (${updateData.stock_quantity}) below the ${reserved} unit(s) already reserved for pending checkouts.`);
        error.statusCode = 400;
        throw error;
      }
    }
    return await variantModel.update(variantId, updateData);
  }

  async deleteVariant(variantId) {
    return await variantModel.delete(variantId);
  }

  async searchProducts(query, limit = 10) {
    if (!query) throw new Error('Search query is required');
    return await productModel.search(query, limit, SINGLE_STORE_ID);
  }

  async getPriceRange(query, user) {
    const filters = {
      status:         query.status,
      category_id:    query.category_id,
      brand_id:       query.brand_id,
      subcategory_id: query.subcategory_id,
      is_featured: query.featured === 'true' ? true : undefined,
      search:      query.search,
      store_id:    SINGLE_STORE_ID
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

    return await productModel.getPriceRange(filters);
  }

  async getRelatedProducts(productId) {
    const product = await productModel.findById(productId, SINGLE_STORE_ID);
    if (!product) throw new Error('Product not found');
    return await productModel.getRelatedProducts(productId);
  }

  async addRelatedProduct(productId, relatedProductId) {
    const product = await productModel.findById(productId, SINGLE_STORE_ID);
    if (!product) throw new Error('Product not found');
    
    const relatedProduct = await productModel.findById(relatedProductId, SINGLE_STORE_ID);
    if (!relatedProduct) {
      const error = new Error('Related product not found');
      error.statusCode = 404;
      throw error;
    }

    return await productModel.addRelatedProduct(productId, relatedProductId, SINGLE_STORE_ID);
  }

  async removeRelatedProduct(productId, relatedProductId) {
    const product = await productModel.findById(productId, SINGLE_STORE_ID);
    if (!product) throw new Error('Product not found');
    return await productModel.removeRelatedProduct(productId, relatedProductId);
  }
}

module.exports = new ProductService();
module.exports.computeDiscountPercentage = computeDiscountPercentage;
