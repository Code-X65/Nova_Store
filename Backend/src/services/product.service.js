const productModel = require('../models/product.model');
const variantModel = require('../models/product-variant.model');
const slugify = require('../utils/slug-generator');

class ProductService {
  async createProduct(adminId, productData) {
    const { variants, ...baseData } = productData;
    
    // 1. Generate Slug
    if (!baseData.slug) {
      baseData.slug = slugify(baseData.name);
    }
    
    // Check if slug exists, append random if needed
    const existing = await productModel.findBySlug(baseData.slug);
    if (existing) {
      baseData.slug = `${baseData.slug}-${Math.floor(Math.random() * 1000)}`;
    }

    // 2. Calculate Discount
    if (baseData.price && baseData.sale_price) {
      baseData.discount_percentage = ((baseData.price - baseData.sale_price) / baseData.price) * 100;
    }

    // 3. Create Product
    const product = await productModel.create({
      ...baseData,
      created_by: adminId,
      status: baseData.status || 'draft'
    });

    // 4. Create Variants if any
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
      status: query.status,
      category: query.category,
      brand: query.brand,
      is_featured: query.featured === 'true' ? true : undefined,
      search: query.search,
      sortBy: query.sortBy,
      order: query.order,
      minPrice: query.minPrice ? parseFloat(query.minPrice) : undefined,
      maxPrice: query.maxPrice ? parseFloat(query.maxPrice) : undefined,
      minRating: query.minRating ? parseFloat(query.minRating) : undefined
    };

    // Non-admins only see published products
    const isAdmin = user && (user.role === 'ADMIN' || (user.roles && user.roles.includes('admin')));
    if (!isAdmin) {
      filters.status = 'published';
    }

    const pagination = {
      page: parseInt(query.page) || 1,
      limit: parseInt(query.limit) || 20
    };

    return await productModel.findAll(filters, pagination);
  }

  async updateProduct(productId, updateData) {
    if (updateData.name && !updateData.slug) {
      updateData.slug = slugify(updateData.name);
    }
    
    if (updateData.price && updateData.sale_price) {
      updateData.discount_percentage = ((updateData.price - updateData.sale_price) / updateData.price) * 100;
    }

    return await productModel.update(productId, updateData);
  }
}

module.exports = new ProductService();
