const productService = require('../../../src/services/product.service');
const productModel = require('../../../src/models/product.model');
const variantModel = require('../../../src/models/product-variant.model');
const productCategoryModel = require('../../../src/models/product-category.model');
const productBrandModel = require('../../../src/models/product-brand.model');
const attributeService = require('../../../src/services/attribute.service');

jest.mock('../../../src/models/product.model');
jest.mock('../../../src/models/product-variant.model');
jest.mock('../../../src/models/product-category.model');
jest.mock('../../../src/models/product-brand.model');
jest.mock('../../../src/services/attribute.service');

describe('ProductService Unit Tests', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createProduct', () => {
    const adminId = 'admin-uuid';
    const baseProductData = {
      name: 'Test Product',
      price: 100,
      category_id: 'cat-uuid',
      brand_id: 'brand-uuid'
    };

    it('should throw error if category not found', async () => {
      productCategoryModel.findById.mockImplementation((id) => {
        if (id === 'cat-uuid') return null;
        return null;
      });

      await expect(productService.createProduct(adminId, baseProductData))
        .rejects.toThrow('Category not found');
    });

    it('should throw error if brand not found', async () => {
      productCategoryModel.findById.mockResolvedValue({ id: 'cat-uuid', slug: 'cat-slug' });
      productBrandModel.findById.mockResolvedValue(null);

      await expect(productService.createProduct(adminId, baseProductData))
        .rejects.toThrow('Brand not found');
    });

    it('should throw error if subcategory not found', async () => {
      productCategoryModel.findById.mockImplementation((id) => {
        if (id === 'cat-uuid') return { id: 'cat-uuid', slug: 'cat-slug' };
        if (id === 'subcat-uuid') return null;
        return null;
      });
      productBrandModel.findById.mockResolvedValue({ id: 'brand-uuid', name: 'Brand Name' });

      await expect(productService.createProduct(adminId, { ...baseProductData, subcategory_id: 'subcat-uuid' }))
        .rejects.toThrow('Subcategory not found');
    });

    it('should throw error if subcategory does not belong to category', async () => {
      productCategoryModel.findById.mockImplementation((id) => {
        if (id === 'cat-uuid') return { id: 'cat-uuid', slug: 'cat-slug' };
        if (id === 'subcat-uuid') return { id: 'subcat-uuid', slug: 'subcat-slug', parent_id: 'other-cat-uuid' };
        return null;
      });
      productBrandModel.findById.mockResolvedValue({ id: 'brand-uuid', name: 'Brand Name' });

      await expect(productService.createProduct(adminId, { ...baseProductData, subcategory_id: 'subcat-uuid' }))
        .rejects.toThrow('Subcategory must be a child of the primary category');
    });

    it('should create product successfully when all validations pass', async () => {
      productCategoryModel.findById.mockImplementation((id) => {
        if (id === 'cat-uuid') return { id: 'cat-uuid', slug: 'cat-slug' };
        if (id === 'subcat-uuid') return { id: 'subcat-uuid', slug: 'subcat-slug', parent_id: 'cat-uuid' };
        return null;
      });
      productBrandModel.findById.mockResolvedValue({ id: 'brand-uuid', name: 'Brand Name' });
      attributeService.validateAttributes.mockResolvedValue({ valid: true, errors: [] });
      productModel.findBySlug.mockResolvedValue(null);
      
      // Mock returns product with populated fields to simulate trigger
      productModel.create.mockImplementation((data) => ({
        id: 'product-uuid',
        ...data,
        category: 'cat-slug',
        subcategory: 'subcat-slug',
        brand: 'Brand Name'
      }));

      const result = await productService.createProduct(adminId, {
        ...baseProductData,
        subcategory_id: 'subcat-uuid'
      });

      expect(result.id).toBe('product-uuid');
      expect(result.category).toBe('cat-slug');
      expect(result.subcategory).toBe('subcat-slug');
      expect(result.brand).toBe('Brand Name');
      expect(productModel.create).toHaveBeenCalled();
    });

    it('should retry generating slug up to 10 times on collision', async () => {
      productCategoryModel.findById.mockResolvedValue({ id: 'cat-uuid', slug: 'cat-slug' });
      productBrandModel.findById.mockResolvedValue({ id: 'brand-uuid', name: 'Brand Name' });
      attributeService.validateAttributes.mockResolvedValue({ valid: true, errors: [] });
      
      // Simulate collision on first check, success on second
      productModel.findBySlug
        .mockResolvedValueOnce({ id: 'existing-product-id' })
        .mockResolvedValueOnce(null);

      productModel.create.mockImplementation((data) => ({ id: 'product-uuid', ...data }));

      const result = await productService.createProduct(adminId, baseProductData);
      expect(result.slug).toMatch(/^test-product-\d+$/);
    });
  });

  describe('updateProduct', () => {
    const productId = 'product-uuid';
    const existingProduct = {
      id: productId,
      category_id: 'cat-uuid',
      subcategory_id: 'subcat-uuid',
      brand_id: 'brand-uuid',
      slug: 'test-product'
    };

    it('should validate subcategory and category hierarchy matches during update', async () => {
      productModel.findById.mockResolvedValue(existingProduct);
      productCategoryModel.findById.mockImplementation((id) => {
        if (id === 'new-cat-uuid') return { id: 'new-cat-uuid', slug: 'new-cat-slug' };
        if (id === 'subcat-uuid') return { id: 'subcat-uuid', slug: 'subcat-slug', parent_id: 'cat-uuid' };
        return null;
      });

      await expect(productService.updateProduct(productId, { category_id: 'new-cat-uuid' }))
        .rejects.toThrow('Existing subcategory is not a child of the new primary category');
    });

    it('should retry generating slug on update if collision occurs', async () => {
      productModel.findById.mockResolvedValue(existingProduct);
      
      // Simulate collision on first check, success on second
      productModel.findBySlug
        .mockResolvedValueOnce({ id: 'other-product-id' })
        .mockResolvedValueOnce(null);

      productModel.update.mockImplementation((id, data) => ({ id, ...data }));

      const result = await productService.updateProduct(productId, { name: 'New Name' });
      expect(result.slug).toMatch(/^new-name-\d+$/);
    });
  });
});
