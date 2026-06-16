const Joi = require('joi');

const trackSearch = {
  body: Joi.object().keys({
    search_query: Joi.string().trim().min(1).max(255).required().messages({
      'any.required': 'Search query is required',
      'string.empty': 'Search query cannot be empty',
      'string.max': 'Search query cannot exceed 255 characters'
    })
  })
};

const trackView = {
  body: Joi.object().keys({
    product_id: Joi.string().uuid().required().messages({
      'any.required': 'Product ID is required',
      'string.uuid': 'Product ID must be a valid UUID'
    }),
    view_duration: Joi.number().integer().min(0).optional().default(0).messages({
      'number.base': 'View duration must be a number',
      'number.min': 'View duration cannot be negative'
    })
  })
};

module.exports = {
  trackSearch,
  trackView
};
