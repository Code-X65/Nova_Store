const categoryModel = require('../models/product-category.model');
const slugify = require('../utils/slug-generator');

class CategoryService {
  async createCategory(adminId, categoryData) {
    const { name, parentId } = categoryData;
    
    // 1. Generate Slug
    let slug = slugify(name);
    const existing = await categoryModel.findBySlug(slug);
    if (existing) {
      slug = `${slug}-${Math.floor(Math.random() * 1000)}`;
    }

    // 2. Calculate Level and Full Path
    let level = 0;
    let fullPath = [];
    
    if (parentId) {
      const parent = await categoryModel.findById(parentId);
      if (!parent) throw new Error('Parent category not found');
      level = parent.level + 1;
      fullPath = [...(parent.full_path || []), parent.slug];
    }

    return await categoryModel.create({
      ...categoryData,
      slug,
      level,
      full_path: fullPath,
      parent_id: parentId,
      created_by: adminId
    });
  }

  async getCategoryTree() {
    const all = await categoryModel.findAll();
    
    const buildTree = (parentId = null) => {
      return all
        .filter(c => c.parent_id === parentId)
        .map(c => ({
          ...c,
          children: buildTree(c.id)
        }));
    };

    return buildTree(null);
  }
}

module.exports = new CategoryService();
