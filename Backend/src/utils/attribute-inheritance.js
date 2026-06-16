const categoryModel          = require('../models/product-category.model');
const categoryAttributeModel = require('../models/category-attribute.model');
const { supabaseAdmin }      = require('../config/supabase');

/**
 * resolveInheritedAttributes
 * --------------------------
 * Given a category ID, returns the merged set of attribute templates
 * from the category AND all its ancestors, with child templates
 * taking precedence over parent templates of the same name.
 *
 * Uses the existing `full_path` (slug array) + `id` stored on
 * product_categories rather than a recursive CTE.
 *
 * @param {string} categoryId
 * @returns {Promise<object[]>} merged array of attribute template rows
 */
async function resolveInheritedAttributes(categoryId) {
  // 1. Fetch the target category to get its full_path (ancestor slugs)
  const category = await categoryModel.findById(categoryId);
  if (!category) {
    const err = new Error('Category not found');
    err.statusCode = 404;
    throw err;
  }

  // 2. Collect ancestor IDs from full_path slugs (root → parent)
  //    full_path stores slugs, so we need to look up their IDs.
  const ancestorIds = [];
  if (category.full_path && category.full_path.length > 0) {
    const { data: ancestors, error } = await supabaseAdmin
      .from('product_categories')
      .select('id, slug, level')
      .in('slug', category.full_path)
      .is('deleted_at', null)
      .order('level', { ascending: true }); // root first

    if (error) throw error;
    ancestors.forEach(a => ancestorIds.push(a.id));
  }

  // 3. Fetch attribute templates for all ancestor IDs + current category
  const allCategoryIds = [...ancestorIds, categoryId];
  const allTemplates   = await categoryAttributeModel.findByCategoryIds(allCategoryIds);

  // 4. Merge: iterate from root → leaf so child definitions overwrite parent ones
  //    Key = lowercase attribute_name for case-insensitive deduplication
  const merged = new Map();

  // Build a lookup: categoryId → index position in allCategoryIds
  // (lower index = higher ancestor = lower specificity)
  const specificityOrder = Object.fromEntries(
    allCategoryIds.map((id, idx) => [id, idx])
  );

  // Sort templates so the most-specific category comes last (will overwrite)
  const sorted = [...allTemplates].sort(
    (a, b) => specificityOrder[a.category_id] - specificityOrder[b.category_id]
  );

  for (const template of sorted) {
    merged.set(template.attribute_name.toLowerCase(), template);
  }

  return Array.from(merged.values());
}

module.exports = { resolveInheritedAttributes };
