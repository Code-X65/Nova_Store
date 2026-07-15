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

/**
 * @swagger
 * tags:
 *   - name: Admin Warehouses
 *     description: Warehouse locations and stock levels
 */

/**
 * @swagger
 * /admin/warehouses:
 *   get:
 *     summary: List all warehouses
 *     tags: [Admin Warehouses]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of warehouses
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/', hasPermission('inventory:read'), warehouseController.list);

/**
 * @swagger
 * /admin/warehouses:
 *   post:
 *     summary: Create a warehouse
 *     tags: [Admin Warehouses]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code, name]
 *             properties:
 *               code: { type: string, maxLength: 50 }
 *               name: { type: string, maxLength: 120 }
 *               location: { type: string, maxLength: 200, nullable: true }
 *     responses:
 *       201:
 *         description: Warehouse created
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.post('/', requireInventoryStaff, validate(warehouseSchema), warehouseController.create);

/**
 * @swagger
 * /admin/warehouses/{id}:
 *   put:
 *     summary: Update a warehouse
 *     tags: [Admin Warehouses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               code: { type: string, maxLength: 50 }
 *               name: { type: string, maxLength: 120 }
 *               location: { type: string, maxLength: 200, nullable: true }
 *     responses:
 *       200:
 *         description: Warehouse updated
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Warehouse not found
 */
router.put('/:id', requireInventoryStaff, warehouseController.update);

/**
 * @swagger
 * /admin/warehouses/{id}:
 *   delete:
 *     summary: Delete a warehouse
 *     tags: [Admin Warehouses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Warehouse deleted
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Warehouse not found
 */
router.delete('/:id', requireInventoryStaff, warehouseController.remove);

/**
 * @swagger
 * /admin/warehouses/stock:
 *   get:
 *     summary: Get stock levels by location (optionally filtered)
 *     tags: [Admin Warehouses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: productId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: variantId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: warehouseId
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Stock levels
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/stock', hasPermission('inventory:read'), warehouseController.getStock);

/**
 * @swagger
 * /admin/warehouses/stock:
 *   post:
 *     summary: Set the stock level for a product/variant at a warehouse
 *     tags: [Admin Warehouses]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [warehouseId, quantity]
 *             properties:
 *               productId: { type: string, format: uuid, nullable: true }
 *               variantId: { type: string, format: uuid, nullable: true }
 *               warehouseId: { type: string, format: uuid }
 *               quantity: { type: integer, minimum: 0 }
 *               lowStockThreshold: { type: integer, minimum: 0 }
 *     responses:
 *       200:
 *         description: Stock level set
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.post('/stock', requireInventoryStaff, validate(setLevelSchema), warehouseController.setStock);

/**
 * @swagger
 * /admin/warehouses/transfer:
 *   post:
 *     summary: Transfer stock between two warehouses
 *     tags: [Admin Warehouses]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fromWarehouseId, toWarehouseId, quantity]
 *             properties:
 *               productId: { type: string, format: uuid, nullable: true }
 *               variantId: { type: string, format: uuid, nullable: true }
 *               fromWarehouseId: { type: string, format: uuid }
 *               toWarehouseId: { type: string, format: uuid }
 *               quantity: { type: integer, minimum: 1 }
 *               notes: { type: string, maxLength: 500, nullable: true }
 *     responses:
 *       200:
 *         description: Stock transferred
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.post('/transfer', requireInventoryStaff, validate(transferSchema), warehouseController.transfer);

module.exports = router;
