const express = require('express');
const router = express.Router();
const shippingAdminController = require('../../controllers/admin/shipping.admin.controller');
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

const zoneSchema = joi.object({
  name: joi.string().required(),
  countries: joi.array().items(joi.string()).min(1).required(),
  states: joi.array().items(joi.string()).optional(),
  is_active: joi.boolean().optional(),
  rate_strategy: joi.object({
    type: joi.string().valid('flat', 'weight_based', 'price_threshold', 'free_over_x').optional(),
    amount: joi.number().min(0).optional(),
    threshold: joi.number().min(0).optional(),
    name: joi.string().optional(),
    estimated_days_min: joi.number().min(0).optional(),
    estimated_days_max: joi.number().min(0).optional(),
  }).optional()
});

const rateSchema = joi.object({
  zone_id: joi.string().uuid().required(),
  name: joi.string().required(),
  min_weight: joi.number().min(0).optional(),
  max_weight: joi.number().min(0).allow(null).optional(),
  min_order_amount: joi.number().min(0).optional(),
  rate: joi.number().min(0).required(),
  estimated_days_min: joi.number().min(0).optional(),
  estimated_days_max: joi.number().min(0).optional(),
  is_active: joi.boolean().optional()
});

// All shipping admin routes require authentication
router.use(requireAdmin);

/**
 * @swagger
 * tags:
 *   name: Admin Shipping
 *   description: Admin management of shipping zones and rates
 */

/**
 * @swagger
 * /admin/shipping/zones:
 *   get:
 *     summary: List all shipping zones
 *     tags: [Admin Shipping]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of zones
 *   post:
 *     summary: Create a new shipping zone
 *     tags: [Admin Shipping]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Created zone
 */
router.get('/zones',        hasPermission('shipping:read'),  shippingAdminController.getZones);
router.post('/zones',       hasPermission('shipping:write'), validateRequest(zoneSchema), shippingAdminController.createZone);

/**
 * @swagger
 * /admin/shipping/zones/{id}:
 *   put:
 *     summary: Update a shipping zone
 *     tags: [Admin Shipping]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Updated zone
 *   delete:
 *     summary: Delete a shipping zone
 *     tags: [Admin Shipping]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Zone deleted
 */
router.put('/zones/:id',    hasPermission('shipping:write'), shippingAdminController.updateZone);
router.delete('/zones/:id', hasPermission('shipping:write'), shippingAdminController.deleteZone);

/**
 * @swagger
 * /admin/shipping/rates:
 *   get:
 *     summary: List all shipping rates
 *     tags: [Admin Shipping]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of rates
 */
router.get('/rates',        hasPermission('shipping:read'),  shippingAdminController.getRates);
router.post('/rates',       hasPermission('shipping:write'), validateRequest(rateSchema), shippingAdminController.createRate);
router.put('/rates/:id',    hasPermission('shipping:write'), shippingAdminController.updateRate);
router.delete('/rates/:id', hasPermission('shipping:write'), shippingAdminController.deleteRate);

module.exports = router;
