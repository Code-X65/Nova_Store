const express = require('express');
const router = express.Router();
const shippingController = require('../controllers/shipping.controller');
const { protect } = require('../middlewares/auth.middleware');
const joi = require('joi');

const validateRequest = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({ success: false, error: error.details[0].message });
  }
  next();
};

const shippingSchema = joi.object({
  cartId: joi.string().uuid().optional(),
  address: joi.object({
    country: joi.string().required(),
    state: joi.string().allow('', null).optional(),
    zipCode: joi.string().allow('', null).optional(),
    city: joi.string().allow('', null).optional(),
    street: joi.string().allow('', null).optional()
  }).required(),
  cartTotal: joi.number().min(0).required(),
  cartWeight: joi.number().min(0).optional()
});

/**
 * @swagger
 * tags:
 *   name: Shipping
 *   description: Shipping endpoints
 */

/**
 * @swagger
 * /api/v1/shipping/zones:
 *   get:
 *     summary: Get all active shipping zones
 *     tags: [Shipping]
 *     responses:
 *       200:
 *         description: List of zones
 */
router.get('/zones', shippingController.getZones);

/**
 * @swagger
 * /api/v1/shipping/calculate:
 *   post:
 *     summary: Calculate shipping options for a cart/address
 *     tags: [Shipping]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               cartTotal:
 *                 type: number
 *               cartWeight:
 *                 type: number
 *               address:
 *                 type: object
 *                 properties:
 *                   country:
 *                     type: string
 *                   state:
 *                     type: string
 *     responses:
 *       200:
 *         description: List of available shipping rates
 */
router.post('/calculate', validateRequest(shippingSchema), shippingController.calculateShipping);

// For backwards compatibility with the plan: 
// Plan mentions POST /api/v1/checkout/shipping
// We'll update app.js or checkout route accordingly or just point the old route here

module.exports = router;
