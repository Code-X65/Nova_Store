const express = require('express');
const router = express.Router();
const crmController = require('../../controllers/admin/crm.admin.controller');
const requireAdmin = require('../../middlewares/require-admin.middleware');
const { hasPermission, hasAnyPermission } = require('../../middlewares/permission.middleware');

router.use(requireAdmin);
router.use(hasAnyPermission('crm:read', 'segment:read', 'customer_event:read'));

/**
 * @swagger
 * tags:
 *   name: Admin CRM
 *   description: Customer relationship management (Phase 7 §9)
 */

/**
 * @swagger
 * /admin/crm/segments:
 *   get:
 *     summary: List customer segments
 *     tags: [Admin CRM]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: is_active
 *         schema: { type: boolean }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Filters segments by name (case-insensitive)
 *     responses:
 *       200:
 *         description: List of segments
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/segments', hasPermission('segment:read'), crmController.listSegments);

/**
 * @swagger
 * /admin/crm/segments:
 *   post:
 *     summary: Create a customer segment
 *     tags: [Admin CRM]
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
 *               name: { type: string }
 *               description: { type: string }
 *               rules: { type: object, description: "Segment matching rules (JSON), defaults to {}" }
 *               is_active: { type: boolean, default: true }
 *     responses:
 *       201:
 *         description: Segment created
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.post('/segments', hasPermission('segment:write'), crmController.createSegment);

/**
 * @swagger
 * /admin/crm/segments/{id}:
 *   get:
 *     summary: Get a customer segment by ID
 *     tags: [Admin CRM]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Segment details
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 */
router.get('/segments/:id', hasPermission('segment:read'), crmController.getSegment);

/**
 * @swagger
 * /admin/crm/segments/{id}:
 *   put:
 *     summary: Update a customer segment
 *     tags: [Admin CRM]
 *     security:
 *       - bearerAuth: []
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
 *               name: { type: string }
 *               description: { type: string }
 *               rules: { type: object }
 *               is_active: { type: boolean }
 *     responses:
 *       200:
 *         description: Segment updated
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 */
router.put('/segments/:id', hasPermission('segment:write'), crmController.updateSegment);

/**
 * @swagger
 * /admin/crm/segments/{id}:
 *   delete:
 *     summary: Delete a customer segment
 *     tags: [Admin CRM]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Segment deleted
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 */
router.delete('/segments/:id', hasPermission('segment:write'), crmController.deleteSegment);

/**
 * @swagger
 * /admin/crm/events:
 *   get:
 *     summary: List customer behavioral events
 *     tags: [Admin CRM]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50 }
 *       - in: query
 *         name: customer_id
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: event_type
 *         schema: { type: string, enum: [page_view, product_view, cart_add, cart_remove, checkout_start, checkout_abandon, search, wishlist_add, review_submit] }
 *       - in: query
 *         name: fromDate
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: toDate
 *         schema: { type: string, format: date-time }
 *     responses:
 *       200:
 *         description: List of customer events
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/events', hasPermission('customer_event:read'), crmController.listCustomerEvents);

/**
 * @swagger
 * /admin/crm/events/product/{productId}/heatmap:
 *   get:
 *     summary: Get product view heatmap events
 *     tags: [Admin CRM]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date-time }
 *     responses:
 *       200:
 *         description: Product heatmap events
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/events/product/:productId/heatmap', hasPermission('customer_event:read'), crmController.getProductHeatmap);

/**
 * @swagger
 * /admin/crm/events/top-products:
 *   get:
 *     summary: Get top viewed products by customer event volume
 *     tags: [Admin CRM]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *     responses:
 *       200:
 *         description: Top viewed products
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/events/top-products', hasPermission('customer_event:read'), crmController.getTopViewedProducts);

module.exports = router;
