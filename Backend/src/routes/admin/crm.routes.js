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

router.get('/segments', hasPermission('segment:read'), crmController.listSegments);

router.post('/segments', hasPermission('segment:write'), crmController.createSegment);

router.get('/segments/:id', hasPermission('segment:read'), crmController.getSegment);

router.put('/segments/:id', hasPermission('segment:write'), crmController.updateSegment);

router.delete('/segments/:id', hasPermission('segment:write'), crmController.deleteSegment);

router.get('/events', hasPermission('customer_event:read'), crmController.listCustomerEvents);

router.get('/events/product/:productId/heatmap', hasPermission('customer_event:read'), crmController.getProductHeatmap);

router.get('/events/top-products', hasPermission('customer_event:read'), crmController.getTopViewedProducts);

module.exports = router;
