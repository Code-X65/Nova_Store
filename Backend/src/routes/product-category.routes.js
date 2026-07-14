const express = require('express');
const categoryController = require('../controllers/product-category.controller');
const { protect } = require('../middlewares/auth.middleware');
const { hasPermission } = require('../middlewares/permission.middleware');
const validate = require('../middlewares/validate.middleware');
const categoryValidator = require('../validators/category.validator');
const scopeToStore = require('../middlewares/scope-to-store.middleware');
const auditAction = require('../middlewares/audit-action.middleware');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Categories
 *   description: Hierarchical product category management
 * 
 * components:
 *   schemas:
 *     Category:
 *       type: object
 *       required: [name]
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         name:
 *           type: string
 *           example: Headphones
 *         slug:
 *           type: string
 *           example: headphones
 *         description:
 *           type: string
 *         parent_id:
 *           type: string
 *           format: uuid
 *           nullable: true
 *         level:
 *           type: integer
 *           example: 1
 *         sort_order:
 *           type: integer
 *           example: 0
 *         image_url:
 *           type: string
 *           format: uri
 *           description: Full-resolution category image
 *         thumbnail_url:
 *           type: string
 *           format: uri
 *           description: Small/optimised category thumbnail for listing cards
 *         icon:
 *           type: string
 *         is_active:
 *           type: boolean
 *         is_featured:
 *           type: boolean
 *         product_count:
 *           type: integer
 *           description: Auto-maintained product count (updated by database trigger)
 *         meta_title:
 *           type: string
 *           description: SEO title tag for the category page
 *         meta_description:
 *           type: string
 *           description: SEO meta description for the category page
 *         meta_keywords:
 *           type: array
 *           items: { type: string }
 *           description: SEO keywords for the category page
 *         color:
 *           type: string
 *           nullable: true
 *           example: "#4285F4"
 *           description: Display color for UI badges and filter chips
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
 *         description: Filter to only return children of a specific parent category
 *     responses:
 *       200:
 *         description: Categories retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     categories:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/Category' }
 */
router.get('/', categoryController.getAllCategories);

/**
 * @swagger
 * /categories/slug/{slug}:
 *   get:
 *     summary: Get a category by its SEO-friendly slug
 *     tags: [Categories]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *         example: headphones
 *         description: URL-friendly category identifier
 *     responses:
 *       200:
 *         description: Category details with parent info
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     category: { $ref: '#/components/schemas/Category' }
 *       404:
 *         description: Category not found
 */
router.get('/slug/:slug', categoryController.getCategoryBySlug);

/**
 * @swagger
 * /categories/{id}:
 *   get:
 *     summary: Get a single category by UUID
 *     tags: [Categories]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Category details with parent information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     category: { $ref: '#/components/schemas/Category' }
 *       404:
 *         description: Category not found
 */
router.get('/:id', categoryController.getCategoryById);

/**
 * @swagger
 * /categories/{id}/subcategories:
 *   get:
 *     summary: List all subcategories for a given parent category
 *     tags: [Categories]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Parent category UUID
 *     responses:
 *       200:
 *         description: Subcategories retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     subcategories:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/Category' }
 */
router.get('/:id/subcategories', categoryController.getSubcategories);

// Admin Routes
router.use(protect);
router.use(scopeToStore);

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
 *               name:
 *                 type: string
 *                 example: Headphones
 *               parentId:
 *                 type: string
 *                 format: uuid
 *                 description: UUID of the parent category (omit for root-level)
 *               description:
 *                 type: string
 *               image_url:
 *                 type: string
 *                 format: uri
 *                 description: Full-resolution category banner/image
 *               thumbnail_url:
 *                 type: string
 *                 format: uri
 *                 description: Small/optimised category thumbnail for listing cards
 *               icon:
 *                 type: string
 *               color:
 *                 type: string
 *                 nullable: true
 *                 description: Display color for UI badges and filter chips
 *               sort_order:
 *                 type: integer
 *                 default: 0
 *               is_featured:
 *                 type: boolean
 *                 default: false
 *               meta_title:
 *                 type: string
 *                 description: SEO title tag (defaults to category name if omitted)
 *               meta_description:
 *                 type: string
 *                 description: SEO meta description for the category page
 *               meta_keywords:
 *                 type: array
 *                 items: { type: string }
 *                 description: SEO keywords list
 *     responses:
 *       201:
 *         description: Category created successfully
 *       401:
 *         description: Unauthorized
 *       409:
 *         description: Slug already in use
 */
router.post('/', hasPermission('category:create'), validate(categoryValidator.createCategory), auditAction({
  resourceType: 'category',
  actionType: 'CREATE',
  severity: 'info',
  action: 'category.created',
}), categoryController.createCategory);

/**
 * @swagger
 * /categories/bulk:
 *   post:
 *     summary: Bulk create category hierarchies (Admin only)
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: array
 *             items:
 *               type: object
 *               required: [name]
 *               properties:
 *                 name:
 *                   type: string
 *                   example: Electronics
 *                 parentId:
 *                   type: string
 *                   format: uuid
 *                   description: Optional parent UUID if nesting flat items
 *                 description:
 *                   type: string
 *                   example: Gadgets, devices, and all things electronic.
 *                 image_url:
 *                   type: string
 *                   format: uri
 *                   example: https://your-cdn.com/categories/electronics.jpg
 *                 thumbnail_url:
 *                   type: string
 *                   format: uri
 *                   example: https://your-cdn.com/categories/electronics-thumb.jpg
 *                 icon:
 *                   type: string
 *                   example: 📱
 *                 color:
 *                   type: string
 *                   nullable: true
 *                   description: Display color for UI badges and filter chips
 *                 sort_order:
 *                   type: integer
 *                   default: 0
 *                 is_featured:
 *                   type: boolean
 *                   default: false
 *                 meta_title:
 *                   type: string
 *                 meta_description:
 *                   type: string
 *                 meta_keywords:
 *                   type: array
 *                   items: { type: string }
 *                 subcategories:
 *                   type: array
 *                   items:
 *                     type: object
 *                   description: Nested child subcategories to create recursively under this parent
 *     responses:
 *       201:
 *         description: Category tree created successfully
 *       400:
 *         description: Invalid payload or validation error
 *       401:
 *         description: Unauthorized
 *       409:
 *         description: Duplicate name or slug conflict under the same parent
 */
router.post('/bulk', hasPermission('category:create'), validate(categoryValidator.bulkCreateCategory), categoryController.createBulkCategories);

/**
 * @swagger
 * /categories/reorder:
 *   put:
 *     summary: Bulk reorder categories (Admin only)
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [categories]
 *             properties:
 *               categories:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [id, sort_order]
 *                   properties:
 *                     id: { type: string, format: uuid }
 *                     sort_order: { type: integer }
 *     responses:
 *       200:
 *         description: Categories reordered successfully
 */
router.put('/reorder', hasPermission('category:write'), categoryController.reorderCategories);

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
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               image_url:
 *                 type: string
 *                 format: uri
 *               thumbnail_url:
 *                 type: string
 *                 format: uri
 *                 description: Small/optimised thumbnail (replaces old value)
 *               icon:
 *                 type: string
 *               color:
 *                 type: string
 *                 nullable: true
 *                 description: Display color for UI badges and filter chips
 *               sort_order:
 *                 type: integer
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
 *         description: Category updated successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Category not found
 */
router.patch('/:id', hasPermission('category:write'), validate(categoryValidator.updateCategory), auditAction({
  resourceType: 'category',
  actionType: 'UPDATE',
  severity: 'info',
  action: 'category.updated',
}), categoryController.updateCategory);

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
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Category not found
 *       409:
 *         description: Cannot delete — category has subcategories
 */
router.delete('/:id', hasPermission('category:write'), auditAction({
  resourceType: 'category',
  actionType: 'DELETE',
  severity: 'info',
  action: 'category.deleted',
  getResourceId: (req) => req.params.id,
}), categoryController.deleteCategory);

module.exports = router;
