const categoryModel = require('../models/product-category.model');
const slugify = require('../utils/slug-generator');
const { SINGLE_STORE_ID } = require('../config/store');

class CategoryService {
  async createCategory(adminId, categoryData) {
    const { name, parentId, ...rest } = categoryData;
    
    const targetParentId = parentId === '' ? null : (parentId || null);

    // 1. Duplicate check: same parent, same name (case-insensitive)
    const siblings = await categoryModel.findAll({ parentId: targetParentId, store_id: SINGLE_STORE_ID });
    const hasDuplicateName = siblings.some(
      sibling => sibling.name.toLowerCase() === name.toLowerCase()
    );
    if (hasDuplicateName) {
      const error = new Error(`Category "${name}" already exists under this parent.`);
      error.statusCode = 409;
      throw error;
    }

    // 2. Generate Slug
    let slug = slugify(name);
    const existing = await categoryModel.findBySlug(slug, SINGLE_STORE_ID);
    if (existing) {
      slug = `${slug}-${Math.floor(Math.random() * 1000)}`;
    }

    // 3. Calculate Level and Full Path
    let level = 0;
    let fullPath = [];
    
    if (targetParentId) {
      const parent = await categoryModel.findById(targetParentId, SINGLE_STORE_ID);
      if (!parent) {
        const error = new Error('Parent category not found');
        error.statusCode = 400;
        throw error;
      }
      level = parent.level + 1;
      fullPath = [...(parent.full_path || []), parent.slug];
    }

    return await categoryModel.create({
      ...rest,
      name,
      slug,
      level,
      full_path: fullPath,
      parent_id: targetParentId,
      created_by: adminId,
      store_id: SINGLE_STORE_ID
    });
  }

  async createBulkCategories(adminId, categoryTree) {
    const crypto = require('crypto');

    // Fetch existing categories to perform duplicate & slug uniqueness checks in-memory
    const existing = await categoryModel.findAll({ store_id: SINGLE_STORE_ID });
    const existingSlugs = new Set(existing.map(c => c.slug));
    const existingNamesByParent = new Map();

    for (const c of existing) {
      const parentKey = c.parent_id || 'root';
      if (!existingNamesByParent.has(parentKey)) {
        existingNamesByParent.set(parentKey, new Set());
      }
      existingNamesByParent.get(parentKey).add(c.name.toLowerCase());
    }

    const flatCategories = [];
    const generatedSlugs = new Set(existingSlugs);
    const namesByParent = new Map(existingNamesByParent);

    const processItem = (item, parentCategory = null) => {
      const { subcategories, name, ...rest } = item;
      const parentId = parentCategory ? parentCategory.id : null;
      const parentKey = parentId || 'root';

      // 1. Duplicate check (same parent, same name - case-insensitive)
      if (!namesByParent.has(parentKey)) {
        namesByParent.set(parentKey, new Set());
      }
      const parentNames = namesByParent.get(parentKey);
      if (parentNames.has(name.toLowerCase())) {
        const error = new Error(`Category "${name}" already exists under this parent.`);
        error.statusCode = 409;
        throw error;
      }
      parentNames.add(name.toLowerCase());

      // 2. Pre-generate unique UUID on backend
      const id = crypto.randomUUID();

      // 3. Generate unique slug
      let slug = slugify(name);
      if (generatedSlugs.has(slug)) {
        slug = `${slug}-${Math.floor(Math.random() * 1000)}`;
      }
      generatedSlugs.add(slug);

      // 4. Calculate Level and Full Path
      const level = parentCategory ? parentCategory.level + 1 : 0;
      const fullPath = parentCategory ? [...(parentCategory.full_path || []), parentCategory.slug] : [];

      const categoryRecord = {
        ...rest,
        id,
        name,
        slug,
        level,
        full_path: fullPath,
        parent_id: parentId,
        created_by: adminId,
        store_id: SINGLE_STORE_ID,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      flatCategories.push(categoryRecord);

      // Recurse subcategories
      if (subcategories && subcategories.length > 0) {
        for (const sub of subcategories) {
          processItem(sub, categoryRecord);
        }
      }
    };

    for (const rootItem of categoryTree) {
      processItem(rootItem, null);
    }

    // Execute bulk insertion in a single query
    return await categoryModel.createMany(flatCategories);
  }

  async updateCategory(id, updateData) {
    const category = await categoryModel.findById(id, SINGLE_STORE_ID);
    if (!category) {
      const error = new Error('Category not found');
      error.statusCode = 404;
      throw error;
    }

    const { name, parentId, ...rest } = updateData;

    // 1. Check for Duplicate Name under the target parent
    const targetParentId = parentId !== undefined ? (parentId === '' ? null : parentId) : category.parent_id;
    const nameToCheck = name || category.name;
    
    if (name || parentId !== undefined) {
      const siblings = await categoryModel.findAll({ parentId: targetParentId, store_id: SINGLE_STORE_ID });
      const hasDuplicateName = siblings.some(
        sibling => sibling.id !== id && sibling.name.toLowerCase() === nameToCheck.toLowerCase()
      );
      if (hasDuplicateName) {
        const error = new Error(`Category "${nameToCheck}" already exists under this parent.`);
        error.statusCode = 409;
        throw error;
      }
    }

    // 2. Generate Slug
    let slug = category.slug;
    let slugChanged = false;
    if (name && name !== category.name) {
      slug = slugify(name);
      const existing = await categoryModel.findBySlug(slug, SINGLE_STORE_ID);
      if (existing && existing.id !== id) {
        slug = `${slug}-${Math.floor(Math.random() * 1000)}`;
      }
      slugChanged = slug !== category.slug;
    }

    // 3. Parent Change & Hierarchy Recalculation
    let parentIdChanged = false;
    let newParentId = category.parent_id;
    let level = category.level;
    let fullPath = category.full_path;

    if (parentId !== undefined) {
      newParentId = parentId === '' ? null : parentId;
      if (newParentId !== category.parent_id) {
        parentIdChanged = true;
      }
    }

    if (parentIdChanged) {
      if (newParentId === id) {
        const error = new Error('A category cannot be its own parent.');
        error.statusCode = 400;
        throw error;
      }

      if (newParentId === null) {
        level = 0;
        fullPath = [];
      } else {
        const parent = await categoryModel.findById(newParentId, SINGLE_STORE_ID);
        if (!parent) {
          const error = new Error('Parent category not found');
          error.statusCode = 400;
          throw error;
        }

        // Circular check: parent cannot be descendant
        if (parent.slug === category.slug || (parent.full_path && parent.full_path.includes(category.slug))) {
          const error = new Error('Circular hierarchy detected: A category cannot be moved under its own descendant.');
          error.statusCode = 400;
          throw error;
        }

        level = parent.level + 1;
        fullPath = [...(parent.full_path || []), parent.slug];
      }
    }

    // Update Category
    const updated = await categoryModel.update(id, {
      ...rest,
      name: name || category.name,
      slug,
      parent_id: newParentId,
      level,
      full_path: fullPath
    });

    // 4. Update Descendants if path/level changed
    if (parentIdChanged || slugChanged) {
      await this.updateDescendantsPaths(id, [...fullPath, slug], level);
    }

    return updated;
  }

  async deleteCategory(categoryId, options = {}) {
    const category = await categoryModel.findById(categoryId, SINGLE_STORE_ID);
    if (!category) {
      const error = new Error('Category not found');
      error.statusCode = 404;
      throw error;
    }

    const { cascade = false } = options;

    if (!cascade) {
      const children = await categoryModel.findAll({ parentId: categoryId, store_id: SINGLE_STORE_ID });
      if (children.length > 0) {
        const error = new Error('Cannot delete category with subcategories. Use cascade=true to delete all subcategories.');
        error.statusCode = 409;
        throw error;
      }
    } else {
      // Cascade soft-delete: recursively soft-delete children
      await this.cascadeSoftDelete(categoryId);
    }

    return await categoryModel.softDelete(categoryId);
  }

  async cascadeSoftDelete(parentId) {
    const children = await categoryModel.findAll({ parentId, store_id: SINGLE_STORE_ID });
    for (const child of children) {
      await this.cascadeSoftDelete(child.id);
      await categoryModel.softDelete(child.id);
    }
  }

  async updateDescendantsPaths(parentId, parentPath, parentLevel) {
    const children = await categoryModel.findAll({ parentId, store_id: SINGLE_STORE_ID });
    for (const child of children) {
      const childLevel = parentLevel + 1;
      const childPath = parentPath;
      
      await categoryModel.update(child.id, {
        level: childLevel,
        full_path: childPath
      });

      // Recurse into children of this child, appending this child's slug to the parent path
      await this.updateDescendantsPaths(child.id, [...childPath, child.slug], childLevel);
    }
  }

  async getCategoryTree() {
    const all = await categoryModel.findAll({ store_id: SINGLE_STORE_ID });
    
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

  async reorderCategories(categoriesData) {
    const promises = categoriesData.map(async (cat) => {
      if (!cat.id || cat.sort_order === undefined) {
        throw new Error('Each category must have an id and sort_order');
      }
      
      // Ensure the category belongs to the store
      const category = await categoryModel.findById(cat.id, SINGLE_STORE_ID);
      if (!category) {
        throw new Error(`Category ${cat.id} not found`);
      }
      
      return categoryModel.update(cat.id, { sort_order: cat.sort_order });
    });

    await Promise.all(promises);
    return true;
  }
}

module.exports = new CategoryService();
