const Joi = require('joi');

// Fields shared between create and update (used with different required/optional config)
const brandFields = {
  name: Joi.string().min(2).max(100).messages({
    'string.min': 'Brand name must be at least 2 characters',
    'string.max': 'Brand name cannot exceed 100 characters'
  }),
  description: Joi.string().max(2000).optional().allow(null, '').messages({
    'string.max': 'Description cannot exceed 2000 characters'
  }),
  logo_url: Joi.string().uri().optional().allow(null, '').messages({
    'string.uri': 'logo_url must be a valid URI'
  }),
  thumbnail_url: Joi.string().uri().optional().allow(null, '').messages({
    'string.uri': 'thumbnail_url must be a valid URI'
  }),
  banner_url: Joi.string().uri().optional().allow(null, '').messages({
    'string.uri': 'banner_url must be a valid URI'
  }),
  website_url: Joi.string().uri().optional().allow(null, '').messages({
    'string.uri': 'website_url must be a valid URI'
  }),
  is_featured: Joi.boolean().optional().default(false),
  is_active: Joi.boolean().optional(),
  meta_title: Joi.string().max(60).optional().allow(null, '').messages({
    'string.max': 'meta_title cannot exceed 60 characters'
  }),
  meta_description: Joi.string().max(160).optional().allow(null, '').messages({
    'string.max': 'meta_description cannot exceed 160 characters'
  }),
  meta_keywords: Joi.array().items(Joi.string()).optional()
};

const createBrand = {
  body: Joi.object({
    ...brandFields,
    name: brandFields.name.required().messages({
      'any.required': 'Brand name is required',
      'string.min': 'Brand name must be at least 2 characters',
      'string.max': 'Brand name cannot exceed 100 characters'
    })
  })
};

const updateBrand = {
  body: Joi.object({
    ...brandFields
  }).min(1).messages({
    'object.min': 'At least one field must be provided for update'
  })
};

module.exports = {
  createBrand,
  updateBrand
};
