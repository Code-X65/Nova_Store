const express = require('express');
const brandController = require('../controllers/product-brand.controller');
const { protect } = require('../middlewares/auth.middleware');
const { hasPermission } = require('../middlewares/permission.middleware');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Brands
 *   description: Product brand and manufacturer management
 */

// --- Routes ---

/**
 * @swagger
 * /brands:
 *   get:
 *     summary: List all active brands
 *     tags: [Brands]
 *     parameters:
 *       - in: query
 *         name: featuredOnly
 *         schema: { type: boolean }
 *       - in: query
 *         name: activeOnly
 *         schema: { type: boolean, default: true }
 *     responses:
 *       200:
 *         description: List of brands retrieved
 */
router.get('/', brandController.getAllBrands);

/**
 * @swagger
 * /brands/{id}:
 *   get:
 *     summary: Get brand details
 *     tags: [Brands]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Brand object
 */
router.get('/:id', brandController.getBrandById);

// Admin Routes
router.use(protect);

/**
 * @swagger
 * /brands:
 *   post:
 *     summary: Create a new brand (Admin only)
 *     tags: [Brands]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string, example: "Apple" }
 *               description: { type: string }
 *               logo_url: { type: string }
 *               website_url: { type: string }
 *     responses:
 *       201:
 *         description: Brand created successfully
 */
router.post('/', hasPermission('brand:create'), brandController.createBrand);

/**
 * @swagger
 * /brands/{id}:
 *   patch:
 *     summary: Update brand metadata (Admin only)
 *     tags: [Brands]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               is_featured: { type: boolean }
 *     responses:
 *       200:
 *         description: Brand updated
 */
router.patch('/:id', hasPermission('brand:write'), brandController.updateBrand);

/**
 * @swagger
 * /brands/{id}:
 *   delete:
 *     summary: Soft delete a brand (Admin only)
 *     tags: [Brands]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Brand archived
 */
router.delete('/:id', hasPermission('brand:delete'), brandController.deleteBrand);

module.exports = router;
