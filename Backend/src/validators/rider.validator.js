const Joi = require('joi');

const createRider = {
  body: Joi.object({
    first_name: Joi.string().min(1).max(100).required().messages({
      'any.required': 'First name is required'
    }),
    last_name: Joi.string().min(1).max(100).required().messages({
      'any.required': 'Last name is required'
    }),
    phone: Joi.string().min(5).max(20).required().messages({
      'any.required': 'Phone number is required'
    }),
    email: Joi.string().email().optional().allow(null, ''),
    address_jsonb: Joi.object().optional().allow(null),
    id_type: Joi.string().valid('none', 'national_id', 'drivers_license', 'passport', 'other').optional().default('none'),
    id_number: Joi.string().max(50).optional().allow(null, ''),
    vehicle_type: Joi.string().valid('none', 'motorcycle', 'bicycle', 'car', 'van', 'other').optional().default('none'),
    vehicle_registration: Joi.string().max(50).optional().allow(null, ''),
    is_active: Joi.boolean().optional().default(true),
    photo_frontal: Joi.string().uri().required().messages({
      'any.required': 'Frontal photo is required'
    }),
    photo_left_profile: Joi.string().uri().required().messages({
      'any.required': 'Left profile photo is required'
    }),
    photo_right_profile: Joi.string().uri().required().messages({
      'any.required': 'Right profile photo is required'
    }),
    phone_secondary: Joi.string().max(20).optional().allow(null, ''),
    id_doc_url: Joi.string().uri().optional().allow(null, ''),
    vehicle_doc_url: Joi.string().uri().optional().allow(null, ''),
    country: Joi.string().max(100).optional().allow(null, ''),
    state: Joi.string().max(100).optional().allow(null, ''),
    city: Joi.string().max(100).optional().allow(null, ''),
    street_address: Joi.string().max(255).optional().allow(null, '')
  })
};

const updateRider = {
  body: Joi.object({
    first_name: Joi.string().min(1).max(100).optional(),
    last_name: Joi.string().min(1).max(100).optional(),
    phone: Joi.string().min(5).max(20).optional(),
    email: Joi.string().email().optional().allow(null, ''),
    address_jsonb: Joi.object().optional().allow(null),
    id_type: Joi.string().valid('none', 'national_id', 'drivers_license', 'passport', 'other').optional(),
    id_number: Joi.string().max(50).optional().allow(null, ''),
    vehicle_type: Joi.string().valid('none', 'motorcycle', 'bicycle', 'car', 'van', 'other').optional(),
    vehicle_registration: Joi.string().max(50).optional().allow(null, ''),
    is_active: Joi.boolean().optional(),
    photo_frontal: Joi.string().uri().optional().allow(null, ''),
    photo_left_profile: Joi.string().uri().optional().allow(null, ''),
    photo_right_profile: Joi.string().uri().optional().allow(null, ''),
    phone_secondary: Joi.string().max(20).optional().allow(null, ''),
    id_doc_url: Joi.string().uri().optional().allow(null, ''),
    vehicle_doc_url: Joi.string().uri().optional().allow(null, ''),
    country: Joi.string().max(100).optional().allow(null, ''),
    state: Joi.string().max(100).optional().allow(null, ''),
    city: Joi.string().max(100).optional().allow(null, ''),
    street_address: Joi.string().max(255).optional().allow(null, '')
  })
};

const approveRider = {
  body: Joi.object({})
};

const rejectRider = {
  body: Joi.object({
    rejection_reason: Joi.string().max(500).optional().allow(null, '')
  })
};

const createGuarantor = {
  body: Joi.object({
    full_name: Joi.string().max(120).required().messages({
      'any.required': 'Full name is required'
    }),
    relationship: Joi.string().max(60).required().messages({
      'any.required': 'Relationship is required'
    }),
    phone: Joi.string().max(20).required().messages({
      'any.required': 'Phone number is required'
    }),
    address: Joi.string().max(255).required().messages({
      'any.required': 'Address is required'
    }),
    id_type: Joi.string().valid('national_id', 'drivers_license', 'passport', 'other').optional(),
    id_number: Joi.string().max(50).optional().allow(null, '')
  })
};

const updateGuarantor = {
  body: Joi.object({
    full_name: Joi.string().max(120).optional(),
    relationship: Joi.string().max(60).optional(),
    phone: Joi.string().max(20).optional(),
    address: Joi.string().max(255).optional(),
    id_type: Joi.string().valid('national_id', 'drivers_license', 'passport', 'other').optional(),
    id_number: Joi.string().max(50).optional().allow(null, '')
  })
};

module.exports = {
  createRider,
  updateRider,
  approveRider,
  rejectRider,
  createGuarantor,
  updateGuarantor
};
