const { resolveInheritedAttributes } = require('../utils/attribute-inheritance');
const productAttributeModel          = require('../models/product-attribute.model');
const categoryAttributeModel         = require('../models/category-attribute.model');

class AttributeService {
  /**
   * Get the full (inherited) attribute template set for a category.
   * @param {string} categoryId
   * @returns {Promise<object[]>}
   */
  async getInheritedAttributes(categoryId) {
    return resolveInheritedAttributes(categoryId);
  }

  /**
   * Validate a submitted attributes object against a category's templates.
   *
   * @param {string}  categoryId
   * @param {object}  provided       - { "RAM": "8GB", "Storage": "256GB" }
   * @param {boolean} isPartialUpdate - If true, skip required-field check for omitted keys
   * @returns {Promise<{ valid: boolean, errors: string[] }>}
   */
  async validateAttributes(categoryId, provided = {}, isPartialUpdate = false) {
    const errors    = [];
    const templates = await resolveInheritedAttributes(categoryId);

    // Build a name→template map (case-insensitive key)
    const templateMap = new Map(
      templates.map(t => [t.attribute_name.toLowerCase(), t])
    );

    // 1. Check that all required attributes are present (skip in partial mode)
    if (!isPartialUpdate) {
      for (const [key, template] of templateMap) {
        if (template.is_required && !(template.attribute_name in provided) &&
            !(template.attribute_name.toLowerCase() in
              Object.fromEntries(Object.entries(provided).map(([k, v]) => [k.toLowerCase(), v])))) {
          errors.push(`Required attribute "${template.attribute_name}" is missing.`);
        }
      }
    }

    // 2. Validate each provided attribute
    for (const [name, value] of Object.entries(provided)) {
      const template = templateMap.get(name.toLowerCase());

      if (!template) {
        // Unknown attribute — warn but do not block (category may have been updated)
        continue;
      }

      const strVal = String(value).trim();

      switch (template.attribute_type) {
        case 'number':
          if (isNaN(Number(strVal)) || strVal === '') {
            errors.push(`Attribute "${template.attribute_name}" must be a number. Got: "${value}".`);
          }
          break;

        case 'boolean':
          if (!['true', 'false', '1', '0', 'yes', 'no'].includes(strVal.toLowerCase())) {
            errors.push(`Attribute "${template.attribute_name}" must be a boolean (true/false). Got: "${value}".`);
          }
          break;

        case 'enum':
          if (template.allowed_values && template.allowed_values.length > 0) {
            const allowed = template.allowed_values.map(v => v.toLowerCase());
            if (!allowed.includes(strVal.toLowerCase())) {
              errors.push(
                `Attribute "${template.attribute_name}" must be one of: [${template.allowed_values.join(', ')}]. Got: "${value}".`
              );
            }
          }
          break;

        case 'date':
          const dateRegex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/;
          if (!dateRegex.test(strVal)) {
            errors.push(`Attribute "${template.attribute_name}" must be a valid date/ISO-8601 string. Got: "${value}".`);
          }
          break;

        // 'text': no type validation needed
        default:
          break;
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Persist product attribute values to the database.
   * Maps attribute names → IDs using the resolved templates, then upserts.
   *
   * @param {string} productId
   * @param {string} categoryId
   * @param {object} attributeValues - { "RAM": "8GB", "Storage": "256GB" }
   */
  async saveProductAttributes(productId, categoryId, attributeValues = {}) {
    if (!attributeValues || Object.keys(attributeValues).length === 0) return [];

    const templates = await resolveInheritedAttributes(categoryId);

    // Build name (lowercase) → template map
    const nameToTemplate = new Map(
      templates.map(t => [t.attribute_name.toLowerCase(), t])
    );

    const rows = [];
    for (const [name, value] of Object.entries(attributeValues)) {
      const template = nameToTemplate.get(name.toLowerCase());
      if (!template) continue; // Unknown attribute — skip silently

      let typedVal = value;
      if (template.attribute_type === 'number') {
        typedVal = Number(value);
      } else if (template.attribute_type === 'boolean') {
        typedVal = String(value).toLowerCase() === 'true' || value === true || String(value) === '1' || value === 1;
      } else if (template.attribute_type === 'date') {
        typedVal = typeof value === 'string' ? value.trim() : value;
      } else {
        typedVal = typeof value === 'string' ? value.trim() : String(value);
      }

      rows.push({
        attribute_id:    template.id,
        attribute_value: typedVal
      });
    }

    if (rows.length === 0) return [];
    return productAttributeModel.upsertBulk(productId, rows);
  }
}

module.exports = new AttributeService();
