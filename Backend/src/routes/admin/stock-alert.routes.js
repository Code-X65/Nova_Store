const express = require('express');
const stockAlertController = require('../../controllers/admin/stock-alert.controller');
const { protect } = require('../../middlewares/auth.middleware');
const { hasPermission } = require('../../middlewares/permission.middleware');
const validate = require('../../middlewares/validate.middleware');
const Joi = require('joi');

const router = express.Router();

const createSchema = {
  body: Joi.object({
    scope: Joi.string().valid('product', 'variant', 'warehouse', 'global').default('product'),
    productId: Joi.string().uuid().allow(null),
    variantId: Joi.string().uuid().allow(null),
    warehouseId: Joi.string().uuid().allow(null),
    threshold: Joi.number().integer().min(0).required(),
    channels: Joi.array().items(Joi.string()).default(['in_app', 'email']),
    recipientRole: Joi.string().allow(null),
    isActive: Joi.boolean().default(true),
  })
};

router.use(protect);
router.get('/', hasPermission('inventory:read'), stockAlertController.list);
router.post('/', hasPermission('inventory:write'), validate(createSchema), stockAlertController.create);
router.put('/:id', hasPermission('inventory:write'), stockAlertController.update);
router.delete('/:id', hasPermission('inventory:write'), stockAlertController.remove);

module.exports = router;
