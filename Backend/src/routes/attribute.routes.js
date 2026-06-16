const express             = require('express');
const router              = express.Router();
const attributeController = require('../controllers/attribute.controller');
const { protect }         = require('../middlewares/auth.middleware');
const { hasPermission }   = require('../middlewares/permission.middleware');
const validate            = require('../middlewares/validate.middleware');
const Joi                 = require('joi');

// --- Validation Schemas ---

const createAttributeSchema = {
  body: Joi.object({
    attribute_name:  Joi.string().min(1).max(100).required(),
    attribute_type:  Joi.string().valid('text', 'number', 'boolean', 'enum').default('text'),
    is_required:     Joi.boolean().default(false),
    unit:            Joi.string().max(50).allow(null, '').optional(),
    allowed_values:  Joi.array().items(Joi.string()).when('attribute_type', {
      is:   'enum',
      then: Joi.array().min(1).required(),
      otherwise: Joi.array().optional().allow(null)
    }),
    display_order:   Joi.number().integer().min(0).default(0)
  })
};

const updateAttributeSchema = {
  body: Joi.object({
    attribute_name:  Joi.string().min(1).max(100).optional(),
    attribute_type:  Joi.string().valid('text', 'number', 'boolean', 'enum').optional(),
    is_required:     Joi.boolean().optional(),
    unit:            Joi.string().max(50).allow(null, '').optional(),
    allowed_values:  Joi.array().items(Joi.string()).allow(null).optional(),
    display_order:   Joi.number().integer().min(0).optional()
  }).min(1)
};

// --- Routes ---

/**
 * @swagger
 * tags:
 *   name: Category Attributes
 *   description: Dynamic per-category product attribute template management
 */

/**
 * @swagger
 * /categories/{id}/attributes:
 *   get:
 *     summary: Get all attribute templates for a category (including inherited)
 *     tags: [Category Attributes]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: List of attribute templates (own + inherited from parent categories)
 *       404:
 *         description: Category not found
 *   post:
 *     summary: Add a new attribute template to a category (Admin only)
 *     tags: [Category Attributes]
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
 *             required: [attribute_name]
 *             properties:
 *               attribute_name:
 *                 type: string
 *                 example: RAM
 *               attribute_type:
 *                 type: string
 *                 enum: [text, number, boolean, enum]
 *                 default: text
 *               is_required:
 *                 type: boolean
 *                 default: false
 *               unit:
 *                 type: string
 *                 example: GB
 *               allowed_values:
 *                 type: array
 *                 items: { type: string }
 *                 example: ["4GB", "8GB", "16GB", "32GB"]
 *               display_order:
 *                 type: integer
 *                 default: 0
 *     responses:
 *       201:
 *         description: Attribute template created
 *       409:
 *         description: Attribute with this name already exists for the category
 */
router.get('/categories/:id/attributes', attributeController.getAttributes);
router.post(
  '/categories/:id/attributes',
  protect,
  hasPermission('category:write'),
  validate(createAttributeSchema),
  attributeController.createAttribute
);

/**
 * @swagger
 * /attributes/{attributeId}:
 *   put:
 *     summary: Update an attribute template (Admin only)
 *     tags: [Category Attributes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: attributeId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               attribute_name:  { type: string }
 *               attribute_type:  { type: string, enum: [text, number, boolean, enum] }
 *               is_required:     { type: boolean }
 *               unit:            { type: string }
 *               allowed_values:  { type: array, items: { type: string } }
 *               display_order:   { type: integer }
 *     responses:
 *       200:
 *         description: Attribute updated
 *       404:
 *         description: Attribute not found
 *   delete:
 *     summary: Delete an attribute template (Admin only) — cascades to product values
 *     tags: [Category Attributes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: attributeId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Attribute deleted
 *       404:
 *         description: Attribute not found
 */
router.put(
  '/attributes/:attributeId',
  protect,
  hasPermission('category:write'),
  validate(updateAttributeSchema),
  attributeController.updateAttribute
);

router.delete(
  '/attributes/:attributeId',
  protect,
  hasPermission('category:write'),
  attributeController.deleteAttribute
);

module.exports = router;
