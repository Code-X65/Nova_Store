const Joi = require('joi');

// Common validation fields for categories and subcategories
const categoryFields = {
  name: Joi.string().min(2).max(50).required().messages({
    'any.required': 'Category name is required',
    'string.min': 'Category name must be at least 2 characters',
    'string.max': 'Category name cannot exceed 50 characters'
  }),
  // Optional — these fields are nullable in the DB; callers may omit them
  description: Joi.string().min(10).max(500).optional().allow(null, '').messages({
    'string.min': 'Description must be at least 10 characters',
    'string.max': 'Description cannot exceed 500 characters'
  }),
  image_url: Joi.string().uri().optional().allow(null, '').messages({
    'string.uri': 'Image URL must be a valid URI'
  }),
  thumbnail_url: Joi.string().uri().optional().allow(null, '').messages({
    'string.uri': 'Thumbnail URL must be a valid URI'
  }),
  icon: Joi.string().min(1).max(50).optional().allow(null, '').messages({
    'string.min': 'Icon name cannot be empty'
  }),
  color: Joi.string().max(50).optional().allow(null, '').messages({
    'string.max': 'Color cannot exceed 50 characters'
  }),
  sort_order: Joi.number().integer().min(0).optional().default(0),
  is_featured: Joi.boolean().optional().default(false),
  is_active: Joi.boolean().optional().default(true),
  meta_title: Joi.string().max(60).optional().allow(null, ''),
  meta_description: Joi.string().max(160).optional().allow(null, ''),
  meta_keywords: Joi.array().items(Joi.string()).optional()
};

const createCategory = {
  body: Joi.object().keys({
    ...categoryFields,
    parentId: Joi.string().uuid().optional().allow(null, '').messages({
      'string.uuid': 'Parent ID must be a valid UUID'
    })
  })
};

const updateCategory = {
  body: Joi.object().keys({
    name: Joi.string().min(2).max(50).optional(),
    parentId: Joi.string().uuid().optional().allow(null, ''),
    description: Joi.string().min(10).max(500).optional().allow(null, ''),
    image_url: Joi.string().uri().optional().allow(null, ''),
    thumbnail_url: Joi.string().uri().optional().allow(null, ''),
    icon: Joi.string().min(1).max(50).optional().allow(null, ''),
    color: Joi.string().max(50).optional().allow(null, ''),
    sort_order: Joi.number().integer().min(0).optional(),
    is_featured: Joi.boolean().optional(),
    is_active: Joi.boolean().optional(),
    meta_title: Joi.string().max(60).optional().allow(null, ''),
    meta_description: Joi.string().max(160).optional().allow(null, ''),
    meta_keywords: Joi.array().items(Joi.string()).optional()
  })
};

// Recursive schema to validate tree structured bulk categories
const bulkCategoryItem = Joi.object().keys({
  ...categoryFields,
  parentId: Joi.string().uuid().optional().allow(null, ''),
  subcategories: Joi.array().items(Joi.link('#bulkCategoryItem')).optional()
}).id('bulkCategoryItem');

const bulkCreateCategory = {
  body: Joi.array().items(bulkCategoryItem).required().messages({
    'any.required': 'Bulk categories data is required',
    'array.base': 'Bulk categories data must be an array'
  })
};

module.exports = {
  createCategory,
  updateCategory,
  bulkCreateCategory
};
