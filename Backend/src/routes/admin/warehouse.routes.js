const express = require('express');
const warehouseController = require('../../controllers/admin/warehouse.controller');
const { protect } = require('../../middlewares/auth.middleware');
const { hasPermission } = require('../../middlewares/permission.middleware');
const validate = require('../../middlewares/validate.middleware');
const requireInventoryStaff = require('../../middlewares/require-inventory-staff.middleware');
const Joi = require('joi');

const router = express.Router();

const warehouseSchema = {
  body: Joi.object({
    code: Joi.string().max(50).required(),
    name: Joi.string().max(120).required(),
    location: Joi.string().max(200).allow('', null),
  })
};

const setLevelSchema = {
  body: Joi.object({
    productId: Joi.string().uuid().allow(null),
    variantId: Joi.string().uuid().allow(null),
    warehouseId: Joi.string().uuid().required(),
    quantity: Joi.number().integer().min(0).required(),
    lowStockThreshold: Joi.number().integer().min(0).optional(),
  })
};

const transferSchema = {
  body: Joi.object({
    productId: Joi.string().uuid().allow(null),
    variantId: Joi.string().uuid().allow(null),
    fromWarehouseId: Joi.string().uuid().required(),
    toWarehouseId: Joi.string().uuid().required(),
    quantity: Joi.number().integer().positive().required(),
    notes: Joi.string().max(500).allow('', null),
  })
};

router.use(protect);

router.get('/', hasPermission('inventory:read'), warehouseController.list);
router.post('/', requireInventoryStaff, validate(warehouseSchema), warehouseController.create);
router.put('/:id', requireInventoryStaff, warehouseController.update);
router.delete('/:id', requireInventoryStaff, warehouseController.remove);

router.get('/stock', hasPermission('inventory:read'), warehouseController.getStock);
router.post('/stock', requireInventoryStaff, validate(setLevelSchema), warehouseController.setStock);
router.post('/transfer', requireInventoryStaff, validate(transferSchema), warehouseController.transfer);

module.exports = router;
