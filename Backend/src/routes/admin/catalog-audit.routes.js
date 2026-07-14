const express = require('express');
const requireAdmin = require('../../middlewares/require-admin.middleware');
const { hasPermission } = require('../../middlewares/permission.middleware');
const { auditRedaction } = require('../../middlewares/audit-redaction.middleware');
const catalogAuditController = require('../../controllers/admin/catalog-audit.controller');

const router = express.Router();

router.use(requireAdmin);
router.use(auditRedaction);
router.use(hasPermission('audit:read'));

/**
 * @swagger
 * /admin/audit/catalog:
 *   get:
 *     summary: Get catalog-only audit logs
 *     tags: [Admin Audit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: entityType
 *         schema:
 *           type: string
 *       - in: query
 *         name: entityId
 *         schema:
 *           type: string
 *       - in: query
 *         name: actionType
 *         schema:
 *           type: string
 *       - in: query
 *         name: changeCategory
 *         schema:
 *           type: string
 *       - in: query
 *         name: fromDate
 *         schema:
 *           type: string
 *       - in: query
 *         name: toDate
 *         schema:
 *           type: string
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Catalog audit logs retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/', catalogAuditController.getCatalogLogs);

/**
 * @swagger
 * /admin/audit/catalog/stats:
 *   get:
 *     summary: Get catalog change statistics
 *     tags: [Admin Audit]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Catalog stats retrieved successfully
 */
router.get('/stats', catalogAuditController.getCatalogStats);

/**
 * @swagger
 * /admin/audit/entity/{entityType}/{entityId}:
 *   get:
 *     summary: Get full timeline of changes for a single entity
 *     tags: [Admin Audit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: entityType
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: entityId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: Entity timeline retrieved successfully
 */
router.get('/entity/:type/:id', catalogAuditController.getEntityTimeline);

/**
 * @swagger
 * /admin/audit/catalog/export:
 *   get:
 *     summary: Export catalog audit logs to CSV or PDF
 *     tags: [Admin Audit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [csv, pdf]
 *           default: csv
 *     responses:
 *       200:
 *         description: Export file
 */
router.get('/export', catalogAuditController.exportCatalog);

module.exports = router;
