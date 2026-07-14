const express = require('express');
const variantController = require('../../controllers/admin/variant.controller');
const { protect } = require('../../middlewares/auth.middleware');
const { hasPermission } = require('../../middlewares/permission.middleware');
const validate = require('../../middlewares/validate.middleware');
const Joi = require('joi');

const router = express.Router();

const optionsSchema = {
  body: Joi.object({
    options: Joi.array().items(
      Joi.object({
        name: Joi.string().max(60).required(),
        values: Joi.array().items(Joi.string().max(120)).min(1).required(),
      })
    ).optional(),
  })
};

router.use(protect);
router.get('/:id/variant-options', hasPermission('product:read'), variantController.getOptions);
router.post('/:id/variant-options', hasPermission('product:write'), validate(optionsSchema), variantController.replaceOptions);

module.exports = router;
