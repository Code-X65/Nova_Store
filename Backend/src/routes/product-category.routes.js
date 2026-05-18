const express = require('express');
const categoryController = require('../controllers/product-category.controller');
const { protect } = require('../middlewares/auth.middleware');
const { hasPermission } = require('../middlewares/permission.middleware');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Categories
 *   description: Hierarchical product category management
 */

// --- Routes ---

/**
 * @swagger
 * /categories:
 *   get:
 *     summary: List all categories (flat or tree)
 *     tags: [Categories]
 *     parameters:
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [flat, tree], default: flat }
 *         description: Use 'tree' to get nested hierarchical data
 *       - in: query
 *         name: parentId
 *         schema: { type: string, format: uuid }
 *         description: Filter children of a specific category
 *     responses:
 *       200:
 *         description: Categories retrieved successfully
 */
router.get('/', categoryController.getAllCategories);

/**
 * @swagger
 * /categories/{id}:
 *   get:
 *     summary: Get single category details
 *     tags: [Categories]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Category details with parent information
 */
router.get('/:id', categoryController.getCategoryById);

// Admin Routes
router.use(protect);

/**
 * @swagger
 * /categories:
 *   post:
 *     summary: Create a new category (Admin only)
 *     tags: [Categories]
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
 *               name: { type: string, example: "Headphones" }
 *               parentId: { type: string, format: uuid }
 *               description: { type: string }
 *               imageUrl: { type: string }
 *               sortOrder: { type: integer }
 *     responses:
 *       201:
 *         description: Category created successfully
 */
router.post('/', hasPermission('category:create'), categoryController.createCategory);

/**
 * @swagger
 * /categories/{id}:
 *   patch:
 *     summary: Update a category (Admin only)
 *     tags: [Categories]
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
 *               is_active: { type: boolean }
 *               sort_order: { type: integer }
 *     responses:
 *       200:
 *         description: Category updated successfully
 */
router.patch('/:id', hasPermission('category:write'), categoryController.updateCategory);

/**
 * @swagger
 * /categories/{id}:
 *   delete:
 *     summary: Soft delete a category (Admin only)
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Category archived
 *       409:
 *         description: Conflict (e.g. has subcategories)
 */
router.delete('/:id', hasPermission('category:write'), categoryController.deleteCategory);

module.exports = router;
