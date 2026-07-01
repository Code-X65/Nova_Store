const express = require('express');
const wishlistController = require('../controllers/wishlist.controller');
const { protect } = require('../middlewares/auth.middleware');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Wishlist
 *   description: User wishlist management
 */

router.use(protect);

/**
 * @swagger
 * /wishlist:
 *   get:
 *     summary: Get user's wishlist
 *     tags: [Wishlist]
 *     security:
 *       - bearerAuth: []
 *   post:
 *     summary: Add product to wishlist
 *     tags: [Wishlist]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [productId]
 *             properties:
 *               productId: { type: string, format: uuid }
 */
router.get('/', wishlistController.getWishlist);
router.post('/', wishlistController.addToWishlist);

/**
 * @swagger
 * /wishlist/{productId}:
 *   delete:
 *     summary: Remove product from wishlist
 *     tags: [Wishlist]
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema: { type: string, format: uuid }
 */
router.delete('/:productId', wishlistController.removeFromWishlist);

/**
 * @swagger
 * /wishlist/{productId}/check:
 *   get:
 *     summary: Check if product is in user's wishlist
 *     tags: [Wishlist]
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Check result
 */
router.get('/:productId/check', wishlistController.checkInWishlist);
router.post('/merge', wishlistController.mergeWishlist);
router.post('/move-to-cart', wishlistController.moveItemToCart);
router.post('/move-all-to-cart', wishlistController.moveAllToCart);

module.exports = router;
