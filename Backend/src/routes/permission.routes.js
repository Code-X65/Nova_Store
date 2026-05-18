const express = require('express');
const permissionController = require('../controllers/permission.controller');
const { protect } = require('../middlewares/auth.middleware');
const { hasPermission } = require('../middlewares/permission.middleware');
const validate = require('../middlewares/validate.middleware');
const Joi = require('joi');

const router = express.Router();

router.use(protect);

const listSchema = {
  query: Joi.object({
    category: Joi.string().optional(),
    search:   Joi.string().optional(),
    page:     Joi.number().integer().min(1).default(1),
    limit:    Joi.number().integer().min(1).max(100).default(100)
  })
};

const detailSchema = {
  params: Joi.object({ id: Joi.string().guid().required() })
};

/**
 * @swagger
 * tags:
 *   name: Permissions
 *   description: RBAC permission listing & detail
 */

/**
 * @swagger
 * /api/v1/permissions:
 *   get:
 *     summary: List all permissions (with optional category/search filter + pagination)
 *     tags: [Permissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *     responses:
 *       200:
 *         description: Paginated permissions list
 */
router.get('/', validate(listSchema), permissionController.getAllPermissions);

/**
 * @swagger
 * /api/v1/permissions/categories:
 *   get:
 *     summary: List all distinct permission categories
 *     tags: [Permissions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Unique category list
 */
router.get('/categories', permissionController.getPermissionCategories);

/**
 * @swagger
 * /api/v1/permissions/{id}:
 *   get:
 *     summary: Get a single permission by ID
 *     tags: [Permissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Permission detail
 *       404:
 *         description: Not found
 */
router.get('/:id', validate(detailSchema), permissionController.getPermissionById);

module.exports = router;

