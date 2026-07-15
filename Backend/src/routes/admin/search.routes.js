const express = require('express');
const router = express.Router();
const searchController = require('../../controllers/admin/search.controller');

/**
 * @swagger
 * tags:
 *   - name: Admin Search
 *     description: Global cross-entity admin search
 */

/**
 * @swagger
 * /admin/search:
 *   get:
 *     summary: Search across products, orders, customers, staff, categories, brands and coupons
 *     tags: [Admin Search]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema: { type: string, minLength: 2 }
 *         description: Search term (minimum 2 characters); results per category are limited by the caller's permissions
 *     responses:
 *       200:
 *         description: Search results grouped by entity type
 *       401:
 *         description: Unauthorized
 */
router.get('/', searchController.globalSearch);

module.exports = router;
