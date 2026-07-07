const express = require('express');
const brandController = require('../controllers/product-brand.controller');
const { protect } = require('../middlewares/auth.middleware');
const { hasPermission } = require('../middlewares/permission.middleware');
const validate = require('../middlewares/validate.middleware');
const brandValidator = require('../validators/brand.validator');
const scopeToStore = require('../middlewares/scope-to-store.middleware');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Brands
 *   description: Product brand and manufacturer management
 * 
 * components:
 *   schemas:
 *     Brand:
 *       type: object
 *       required: [name]
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         name:
 *           type: string
 *           example: Sony
 *         slug:
 *           type: string
 *           example: sony
 *         description:
 *           type: string
 *         logo_url:
 *           type: string
 *           format: uri
 *           description: Full-resolution brand logo
 *         thumbnail_url:
 *           type: string
 *           format: uri
 *           description: Small/optimised brand logo thumbnail for sliders/cards
 *         banner_url:
 *           type: string
 *           format: uri
 *           description: Brand header/banner image
 *         website_url:
 *           type: string
 *           format: uri
 *           description: Official brand website URL
 *         is_active:
 *           type: boolean
 *         is_featured:
 *           type: boolean
 *         product_count:
 *           type: integer
 *           description: Auto-maintained product count (updated by database trigger)
 *         meta_title:
 *           type: string
 *           description: SEO title tag for the brand landing page
 *         meta_description:
 *           type: string
 *           description: SEO meta description for the brand landing page
 *         meta_keywords:
 *           type: array
 *           items: { type: string }
 *           description: SEO keywords for the brand landing page
 */

// --- Routes ---

/**
 * @swagger
 * /brands:
 *   get:
 *     summary: List brands
 *     tags: [Brands]
 *     parameters:
 *       - in: query
 *         name: featuredOnly
 *         schema: { type: boolean }
 *         description: Return only featured brands
 *       - in: query
 *         name: activeOnly
 *         schema: { type: boolean, default: true }
 *         description: Return only active brands
 *     responses:
 *       200:
 *         description: List of brands retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     brands:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/Brand' }
 */
router.get('/', brandController.getAllBrands);

/**
 * @swagger
 * /brands/slug/{slug}:
 *   get:
 *     summary: Get a brand by its SEO-friendly slug
 *     tags: [Brands]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *         example: sony
 *         description: URL-friendly brand identifier
 *     responses:
 *       200:
 *         description: Brand object
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     brand: { $ref: '#/components/schemas/Brand' }
 *       404:
 *         description: Brand not found
 */
router.get('/slug/:slug', brandController.getBrandBySlug);

/**
 * @swagger
 * /brands/{id}:
 *   get:
 *     summary: Get brand details by UUID
 *     tags: [Brands]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Brand object
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     brand: { $ref: '#/components/schemas/Brand' }
 *       404:
 *         description: Brand not found
 */
router.get('/:id', brandController.getBrandById);

// Admin Routes
router.use(protect);
router.use(scopeToStore);

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
 *               name:
 *                 type: string
 *                 example: Sony
 *               description:
 *                 type: string
 *               logo_url:
 *                 type: string
 *                 format: uri
 *                 description: Full-resolution brand logo URL
 *               thumbnail_url:
 *                 type: string
 *                 format: uri
 *                 description: Small/optimised brand logo thumbnail for sliders/cards
 *               banner_url:
 *                 type: string
 *                 format: uri
 *                 description: Brand header/banner image URL
 *               website_url:
 *                 type: string
 *                 format: uri
 *                 description: Official brand website URL
 *               is_featured:
 *                 type: boolean
 *                 default: false
 *               meta_title:
 *                 type: string
 *                 description: SEO title tag for the brand landing page
 *               meta_description:
 *                 type: string
 *                 description: SEO meta description for the brand landing page
 *               meta_keywords:
 *                 type: array
 *                 items: { type: string }
 *                 description: SEO keywords list
 *     responses:
 *       201:
 *         description: Brand created successfully
 *       401:
 *         description: Unauthorized
 *       409:
 *         description: Brand name or slug already exists
 */
router.post('/', hasPermission('brand:create'), validate(brandValidator.createBrand), brandController.createBrand);

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
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               logo_url:
 *                 type: string
 *                 format: uri
 *               thumbnail_url:
 *                 type: string
 *                 format: uri
 *                 description: Replaces the existing brand thumbnail
 *               banner_url:
 *                 type: string
 *                 format: uri
 *               website_url:
 *                 type: string
 *                 format: uri
 *               is_active:
 *                 type: boolean
 *               is_featured:
 *                 type: boolean
 *               meta_title:
 *                 type: string
 *               meta_description:
 *                 type: string
 *               meta_keywords:
 *                 type: array
 *                 items: { type: string }
 *     responses:
 *       200:
 *         description: Brand updated successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Brand not found
 */
router.patch('/:id', hasPermission('brand:write'), validate(brandValidator.updateBrand), brandController.updateBrand);

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
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Brand not found
 */
router.delete('/:id', hasPermission('brand:delete'), brandController.deleteBrand);

module.exports = router;
