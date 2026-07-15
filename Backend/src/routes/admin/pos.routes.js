const express = require('express');
const router = express.Router();
const adminPosController = require('../../controllers/admin/pos.controller');
const requireAdmin = require('../../middlewares/require-admin.middleware');
const { hasPermission } = require('../../middlewares/permission.middleware');
const joi = require('joi');

const validateRequest = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({ success: false, error: error.details[0].message });
  }
  next();
};

const saleSchema = joi.object({
  customerEmail: joi.string().email().optional().allow(''),
  customerName: joi.string().optional().allow(''),
  customerPhone: joi.string().optional().allow(''),
  paymentMethod: joi.string().valid('cash', 'pos_card', 'pos_transfer').required(),
  items: joi.array().items(joi.object({
    productId: joi.string().uuid().required(),
    variantId: joi.string().uuid().optional().allow(null),
    quantity: joi.number().integer().min(1).required()
  })).min(1).required()
});

router.use(requireAdmin);

/**
 * @swagger
 * tags:
 *   name: Admin POS
 *   description: Point-of-sale / walk-in offline sales
 */

/**
 * @swagger
 * /admin/pos/sales:
 *   get:
 *     summary: List POS (walk-in) sales
 *     tags: [Admin POS]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: List of POS sales
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/sales', hasPermission('pos:read'), adminPosController.getSales);

/**
 * @swagger
 * /admin/pos/sales/{id}:
 *   get:
 *     summary: Get a single POS sale by ID
 *     tags: [Admin POS]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: POS sale details
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 */
router.get('/sales/:id', hasPermission('pos:read'), adminPosController.getSaleById);

/**
 * @swagger
 * /admin/pos/sales:
 *   post:
 *     summary: Create a walk-in POS sale
 *     tags: [Admin POS]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [paymentMethod, items]
 *             properties:
 *               customerEmail: { type: string, format: email }
 *               customerName: { type: string }
 *               customerPhone: { type: string }
 *               paymentMethod: { type: string, enum: [cash, pos_card, pos_transfer] }
 *               items:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required: [productId, quantity]
 *                   properties:
 *                     productId: { type: string, format: uuid }
 *                     variantId: { type: string, format: uuid, nullable: true }
 *                     quantity: { type: integer, minimum: 1 }
 *     responses:
 *       201:
 *         description: Sale created
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.post('/sales', hasPermission('pos:create'), validateRequest(saleSchema), adminPosController.createSale);

module.exports = router;
