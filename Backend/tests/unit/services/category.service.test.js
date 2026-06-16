const categoryService = require('../../../src/services/category.service');
const categoryModel = require('../../../src/models/product-category.model');

jest.mock('../../../src/models/product-category.model');

describe('CategoryService Unit Tests', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createCategory', () => {
    const adminId = 'admin-uuid';

    it('should throw error if duplicate name exists under same parent', async () => {
      const categoryData = { name: 'Smartphones', parentId: 'parent-uuid' };
      
      categoryModel.findAll.mockResolvedValue([
        { id: 'existing-uuid', name: 'smartphones', parent_id: 'parent-uuid' }
      ]);

      await expect(categoryService.createCategory(adminId, categoryData))
        .rejects.toThrow('Category "Smartphones" already exists under this parent.');
    });

    it('should create root category successfully', async () => {
      const categoryData = { name: 'Electronics', parentId: null };
      
      categoryModel.findAll.mockResolvedValue([]);
      categoryModel.findBySlug.mockResolvedValue(null);
      categoryModel.create.mockImplementation((data) => ({ id: 'new-uuid', ...data }));

      const result = await categoryService.createCategory(adminId, categoryData);

      expect(result.name).toBe('Electronics');
      expect(result.level).toBe(0);
      expect(result.full_path).toEqual([]);
      expect(categoryModel.create).toHaveBeenCalledWith(expect.objectContaining({
        parent_id: null,
        level: 0,
        full_path: []
      }));
    });

    it('should create subcategory successfully with correct level and path', async () => {
      const categoryData = { name: 'Smartphones', parentId: 'parent-uuid' };
      
      categoryModel.findAll.mockResolvedValue([]);
      categoryModel.findBySlug.mockResolvedValue(null);
      categoryModel.findById.mockResolvedValue({
        id: 'parent-uuid',
        name: 'Electronics',
        slug: 'electronics',
        level: 0,
        full_path: []
      });
      categoryModel.create.mockImplementation((data) => ({ id: 'new-uuid', ...data }));

      const result = await categoryService.createCategory(adminId, categoryData);

      expect(result.name).toBe('Smartphones');
      expect(result.level).toBe(1);
      expect(result.full_path).toEqual(['electronics']);
    });
  });

  describe('createBulkCategories', () => {
    const adminId = 'admin-uuid';

    it('should create nested categories recursively with correct levels and parent links', async () => {
      const categoryTree = [
        {
          name: 'Electronics',
          description: 'Devices and gadgets.',
          image_url: 'https://example.com/elec.jpg',
          thumbnail_url: 'https://example.com/elec-thumb.jpg',
          icon: 'phone',
          subcategories: [
            {
              name: 'Smartphones',
              description: 'Mobile phones.',
              image_url: 'https://example.com/phones.jpg',
              thumbnail_url: 'https://example.com/phones-thumb.jpg',
              icon: 'smartphone'
            }
          ]
        }
      ];

      categoryModel.findAll.mockResolvedValue([]);
      categoryModel.createMany.mockImplementation((data) => data);

      const results = await categoryService.createBulkCategories(adminId, categoryTree);

      expect(results).toHaveLength(2);

      // Electronics (Root)
      expect(results[0].id).toBeDefined();
      expect(results[0].name).toBe('Electronics');
      expect(results[0].parent_id).toBeNull();
      expect(results[0].level).toBe(0);
      expect(results[0].full_path).toEqual([]);

      // Smartphones (Child)
      expect(results[1].id).toBeDefined();
      expect(results[1].name).toBe('Smartphones');
      expect(results[1].parent_id).toBe(results[0].id);
      expect(results[1].level).toBe(1);
      expect(results[1].full_path).toEqual(['electronics']);
    });
  });

  describe('updateCategory', () => {
    const categoryId = 'category-uuid';
    const existingCategory = {
      id: categoryId,
      name: 'Smartphones',
      slug: 'smartphones',
      parent_id: 'parent-uuid',
      level: 1,
      full_path: ['electronics']
    };

    it('should throw circular reference error if moving under itself', async () => {
      categoryModel.findById.mockResolvedValue(existingCategory);

      await expect(categoryService.updateCategory(categoryId, { parentId: categoryId }))
        .rejects.toThrow('A category cannot be its own parent.');
    });

    it('should throw circular reference error if moving under descendant', async () => {
      categoryModel.findById.mockImplementation((id) => {
        if (id === categoryId) return existingCategory;
        if (id === 'descendant-uuid') {
          return {
            id: 'descendant-uuid',
            name: 'iPhones',
            slug: 'iphones',
            parent_id: 'sub-uuid',
            level: 3,
            full_path: ['electronics', 'smartphones', 'ios']
          };
        }
        return null;
      });

      await expect(categoryService.updateCategory(categoryId, { parentId: 'descendant-uuid' }))
        .rejects.toThrow('Circular hierarchy detected: A category cannot be moved under its own descendant.');
    });

    it('should update slug if name is updated', async () => {
      categoryModel.findById.mockResolvedValue(existingCategory);
      categoryModel.findAll.mockResolvedValue([]);
      categoryModel.findBySlug.mockResolvedValue(null);
      categoryModel.update.mockImplementation((id, data) => ({ id, ...data }));

      const result = await categoryService.updateCategory(categoryId, { name: 'Mobile Devices' });

      expect(result.name).toBe('Mobile Devices');
      expect(result.slug).toBe('mobile-devices');
    });

    it('should update descendants level and path if parent changes', async () => {
      // Setup: existingCategory (Smartphones) has child (iPhones)
      // Moving Smartphones from Electronics (level 0) to Mobiles (level 0, slug: mobiles)
      const targetParent = {
        id: 'new-parent-uuid',
        name: 'Mobiles',
        slug: 'mobiles',
        level: 0,
        full_path: []
      };

      categoryModel.findById.mockImplementation((id) => {
        if (id === categoryId) return existingCategory;
        if (id === 'new-parent-uuid') return targetParent;
        return null;
      });

      // findAll should return sibling categories (none) for validation
      // and child categories of Smartphones during recursive sync
      categoryModel.findAll.mockImplementation((options) => {
        if (options.parentId === 'new-parent-uuid') return []; // siblings
        if (options.parentId === categoryId) {
          return [
            {
              id: 'child-uuid',
              name: 'iPhones',
              slug: 'iphones',
              parent_id: categoryId,
              level: 2,
              full_path: ['electronics', 'smartphones']
            }
          ];
        }
        if (options.parentId === 'child-uuid') return []; // leaf node
        return [];
      });

      categoryModel.update.mockImplementation((id, data) => ({ id, ...data }));

      const result = await categoryService.updateCategory(categoryId, { parentId: 'new-parent-uuid' });

      // Smartphones updated level & full_path
      expect(result.level).toBe(1);
      expect(result.full_path).toEqual(['mobiles']);

      // Child (iPhones) updated level & full_path should be:
      // level: 2, full_path: ['mobiles', 'smartphones']
      expect(categoryModel.update).toHaveBeenCalledWith('child-uuid', {
        level: 2,
        full_path: ['mobiles', 'smartphones']
      });
    });
  });

  describe('deleteCategory', () => {
    const categoryId = 'category-uuid';

    it('should fail delete if category has children and cascade is false', async () => {
      categoryModel.findById.mockResolvedValue({ id: categoryId });
      categoryModel.findAll.mockResolvedValue([{ id: 'child-uuid' }]);

      await expect(categoryService.deleteCategory(categoryId, { cascade: false }))
        .rejects.toThrow('Cannot delete category with subcategories. Use cascade=true to delete all subcategories.');
    });

    it('should recursively soft-delete children if cascade is true', async () => {
      categoryModel.findById.mockResolvedValue({ id: categoryId });
      
      // Hierarchy: parent -> child -> grandchild
      categoryModel.findAll.mockImplementation((options) => {
        if (options.parentId === categoryId) return [{ id: 'child-uuid' }];
        if (options.parentId === 'child-uuid') return [{ id: 'grandchild-uuid' }];
        return [];
      });

      categoryModel.softDelete.mockResolvedValue(true);

      const result = await categoryService.deleteCategory(categoryId, { cascade: true });

      expect(result).toBe(true);
      expect(categoryModel.softDelete).toHaveBeenCalledWith('grandchild-uuid');
      expect(categoryModel.softDelete).toHaveBeenCalledWith('child-uuid');
      expect(categoryModel.softDelete).toHaveBeenCalledWith(categoryId);
    });
  });
});
