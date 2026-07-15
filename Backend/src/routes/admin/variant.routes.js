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

/**
 * @swagger
 * tags:
 *   - name: Admin Product Variants
 *     description: Product variant option management (e.g. size, color)
 */

/**
 * @swagger
 * /admin/products/{id}/variant-options:
 *   get:
 *     summary: Get the variant options for a product
 *     tags: [Admin Product Variants]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Product ID
 *     responses:
 *       200:
 *         description: Variant options
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Product not found
 */
router.get('/:id/variant-options', hasPermission('product:read'), variantController.getOptions);

/**
 * @swagger
 * /admin/products/{id}/variant-options:
 *   post:
 *     summary: Replace the variant options for a product
 *     tags: [Admin Product Variants]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Product ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               options:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [name, values]
 *                   properties:
 *                     name: { type: string, maxLength: 60 }
 *                     values:
 *                       type: array
 *                       items: { type: string, maxLength: 120 }
 *     responses:
 *       200:
 *         description: Variant options replaced
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Product not found
 */
router.post('/:id/variant-options', hasPermission('product:write'), validate(optionsSchema), variantController.replaceOptions);

module.exports = router;
