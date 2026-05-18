const express = require('express');
const inventoryController = require('../controllers/inventory.controller');
const { protect } = require('../middlewares/auth.middleware');
const { hasPermission } = require('../middlewares/permission.middleware');
const validate = require('../middlewares/validate.middleware');
const Joi = require('joi');

const router = express.Router();

// --- Validation Schemas ---

const stockUpdateSchema = {
  body: Joi.object({
    productId: Joi.string().uuid().required(),
    variantId: Joi.string().uuid().allow(null),
    quantity: Joi.number().integer().required(),
    notes: Joi.string().max(500).allow('', null)
  })
};

const reduceStockSchema = {
  body: Joi.object({
    productId: Joi.string().uuid().required(),
    variantId: Joi.string().uuid().allow(null),
    quantity: Joi.number().integer().positive().required(),
    referenceId: Joi.string().uuid().allow(null),
    type: Joi.string().valid('sale', 'adjustment', 'return', 'reservation').default('adjustment'),
    notes: Joi.string().max(500).allow('', null)
  })
};

// --- Routes ---

// All inventory routes are protected and require inventory permissions
router.use(protect);

/**
 * @swagger
 * tags:
 *   name: Inventory
 *   description: Inventory and stock management (Admin only)
 */

/**
 * @swagger
 * /inventory/stock:
 *   post:
 *     summary: Add stock to a product (Admin only)
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [productId, quantity]
 *             properties:
 *               productId: { type: string, format: uuid }
 *               variantId: { type: string, format: uuid }
 *               quantity: { type: integer, example: 50 }
 *               notes: { type: string, example: "New shipment arrival" }
 *     responses:
 *       200:
 *         description: Stock updated successfully
 *       400:
 *         description: Invalid input
 */
router.post('/stock', hasPermission('inventory:write'), validate(stockUpdateSchema), inventoryController.addStock);

/**
 * @swagger
 * /inventory/reduce:
 *   post:
 *     summary: Reduce stock (sale/adjustment) (Admin only)
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [productId, quantity]
 *             properties:
 *               productId: { type: string, format: uuid }
 *               variantId: { type: string, format: uuid }
 *               quantity: { type: integer, example: 5 }
 *               referenceId: { type: string, format: uuid, description: "Order or return ID" }
 *               type: { type: string, enum: [sale, adjustment, return, reservation], default: adjustment }
 *               notes: { type: string, example: "Customer return" }
 *     responses:
 *       200:
 *         description: Stock reduced successfully
 */
router.post('/reduce', hasPermission('inventory:write'), validate(reduceStockSchema), inventoryController.reduceStock);

/**
 * @swagger
 * /inventory/transactions:
 *   get:
 *     summary: Get inventory transaction history (Admin only)
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: productId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [sale, restock, adjustment, return] }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: List of inventory transactions
 */
router.get('/transactions', hasPermission('inventory:read'), inventoryController.getTransactions);

/**
 * @swagger
 * /inventory/low-stock:
 *   get:
 *     summary: Get items below low stock threshold (Admin only)
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of low stock products
 */
router.get('/low-stock', hasPermission('inventory:read'), inventoryController.getLowStock);

/**
 * @swagger
 * /inventory/bulk-update:
 *   post:
 *     summary: Bulk update stock quantities (Admin only)
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               updates:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     productId: { type: string, format: uuid }
 *                     quantity: { type: integer }
 *                     notes: { type: string }
 *     responses:
 *       200:
 *         description: Bulk update completed
 */
router.post('/bulk-update', hasPermission('inventory:write'), inventoryController.bulkUpdate);

/**
 * @swagger
 * /inventory/alerts:
 *   get:
 *     summary: Retrieve current alert configurations (Admin only)
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: productId
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Alert configurations
 *   post:
 *     summary: Configure low stock alert recipients/settings (Admin only)
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               productId: { type: string, format: uuid, description: "Optional - for product-specific alerts" }
 *               threshold: { type: integer, example: 5 }
 *               notifyEmails: { type: array, items: { type: string }, example: ["admin@store.com"] }
 *               enabled: { type: boolean, default: true }
 *     responses:
 *       200:
 *         description: Alert configured successfully
 */
router.get('/alerts', hasPermission('inventory:read'), inventoryController.getAlerts);
router.post('/alerts', hasPermission('inventory:alert'), inventoryController.configureAlerts);

/**
 * @swagger
 * /inventory/{id}:
 *   get:
 *     summary: Get detailed inventory info for a product (Admin only)
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Detailed inventory object
 *       404:
 *         description: Product not found
 */
router.get('/:id', hasPermission('inventory:read'), inventoryController.getProductInventory);

/**
 * @swagger
 * /inventory/{id}/threshold:
 *   put:
 *     summary: Update low stock threshold for a product (Admin only)
 *     tags: [Inventory]
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
 *               lowStockThreshold: { type: integer, example: 10 }
 *     responses:
 *       200:
 *         description: Threshold updated
 */
router.put('/:id/threshold', hasPermission('inventory:write'), inventoryController.updateThreshold);

module.exports = router;
