const express = require('express');
const cartController = require('../controllers/cart.controller');
const { protect } = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');
const Joi = require('joi');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Cart
 *   description: Shopping cart management
 */

// Optional authentication middleware that attaches user to req if token is valid but doesn't block if not
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer')) {
    return protect(req, res, next);
  }
  next();
};

const cartItemSchema = {
  body: Joi.object({
    productId: Joi.string().uuid().required(),
    variantId: Joi.string().uuid().allow(null),
    quantity: Joi.number().integer().min(1).required(),
    sessionId: Joi.string().allow(null)
  })
};

/**
 * @swagger
 * /cart:
 *   get:
 *     summary: Get user's cart (authenticated) or session cart (guest)
 *     tags: [Cart]
 *     parameters:
 *       - in: header
 *         name: x-session-id
 *         schema: { type: string }
 *         description: Session ID for guest users
 *   post:
 *     summary: Add item to cart
 *     tags: [Cart]
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
 *               quantity: { type: integer, example: 1 }
 *               sessionId: { type: string, description: "Required for guests if not in header" }
 *   delete:
 *     summary: Clear entire cart
 *     tags: [Cart]
 */
router.get('/', optionalAuth, cartController.getCart);
router.post('/', optionalAuth, validate(cartItemSchema), cartController.addToCart);
router.delete('/', optionalAuth, cartController.clearCart);

/**
 * @swagger
 * /cart/items/{id}:
 *   put:
 *     summary: Update cart item quantity
 *     tags: [Cart]
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
 *               quantity: { type: integer, example: 3 }
 *   delete:
 *     summary: Remove item from cart
 *     tags: [Cart]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 */
router.put('/items/:id', optionalAuth, cartController.updateItemQuantity);
router.delete('/items/:id', optionalAuth, cartController.removeItem);

/**
 * @swagger
 * /cart/merge:
 *   post:
 *     summary: Merge guest cart with user cart after login
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sessionId]
 *             properties:
 *               sessionId: { type: string }
 */
router.post('/merge', protect, cartController.mergeCart);

module.exports = router;
