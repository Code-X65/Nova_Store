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

/**
 * @swagger
 * tags:
 *   - name: Admin Stock Alerts
 *     description: Low-stock alert rule configuration
 */

/**
 * @swagger
 * /admin/stock-alerts:
 *   get:
 *     summary: List stock alert rules
 *     tags: [Admin Stock Alerts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of stock alert rules
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/', hasPermission('inventory:read'), stockAlertController.list);

/**
 * @swagger
 * /admin/stock-alerts:
 *   post:
 *     summary: Create a stock alert rule
 *     tags: [Admin Stock Alerts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [threshold]
 *             properties:
 *               scope:
 *                 type: string
 *                 enum: [product, variant, warehouse, global]
 *                 default: product
 *               productId: { type: string, format: uuid, nullable: true }
 *               variantId: { type: string, format: uuid, nullable: true }
 *               warehouseId: { type: string, format: uuid, nullable: true }
 *               threshold: { type: integer, minimum: 0 }
 *               channels:
 *                 type: array
 *                 items: { type: string }
 *                 default: [in_app, email]
 *               recipientRole: { type: string, nullable: true }
 *               isActive: { type: boolean, default: true }
 *     responses:
 *       201:
 *         description: Alert rule created
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.post('/', hasPermission('inventory:write'), validate(createSchema), stockAlertController.create);

/**
 * @swagger
 * /admin/stock-alerts/{id}:
 *   put:
 *     summary: Update a stock alert rule
 *     tags: [Admin Stock Alerts]
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
 *               scope:
 *                 type: string
 *                 enum: [product, variant, warehouse, global]
 *               productId: { type: string, format: uuid, nullable: true }
 *               variantId: { type: string, format: uuid, nullable: true }
 *               warehouseId: { type: string, format: uuid, nullable: true }
 *               threshold: { type: integer, minimum: 0 }
 *               channels:
 *                 type: array
 *                 items: { type: string }
 *               recipientRole: { type: string, nullable: true }
 *               isActive: { type: boolean }
 *     responses:
 *       200:
 *         description: Alert rule updated
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Alert rule not found
 */
router.put('/:id', hasPermission('inventory:write'), stockAlertController.update);

/**
 * @swagger
 * /admin/stock-alerts/{id}:
 *   delete:
 *     summary: Delete a stock alert rule
 *     tags: [Admin Stock Alerts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Alert rule deleted
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Alert rule not found
 */
router.delete('/:id', hasPermission('inventory:write'), stockAlertController.remove);

module.exports = router;
