const express = require('express');
const { ImportController, upload } = require('../../controllers/admin/import.controller');
const { protect } = require('../../middlewares/auth.middleware');
const { hasPermission } = require('../../middlewares/permission.middleware');
const Joi = require('joi');
const validate = require('../../middlewares/validate.middleware');

const router = express.Router();

const entityTypeSchema = {
  body: Joi.object({
    entityType: Joi.string().valid('product', 'variant', 'inventory', 'category').required(),
  })
};

// /api/v1/admin is already guarded by requireAdmin in app.js
router.use(protect);

/**
 * @swagger
 * tags:
 *   - name: Admin Import
 *     description: Bulk import jobs (products, variants, inventory, categories) via workbook upload
 */

/**
 * @swagger
 * /admin/import:
 *   post:
 *     summary: Upload a workbook file to start a bulk import job
 *     tags: [Admin Import]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file, entityType]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: .xlsx or .xls workbook (max 25MB)
 *               entityType:
 *                 type: string
 *                 enum: [product, variant, inventory, category]
 *     responses:
 *       202:
 *         description: Import job queued
 *       400:
 *         description: Validation error or missing file
 *       401:
 *         description: Unauthorized
 */
router.post('/', upload.single('file'), validate(entityTypeSchema), ImportController.upload);

/**
 * @swagger
 * /admin/import/{id}:
 *   get:
 *     summary: Get the status of an import job
 *     tags: [Admin Import]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Import job status
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Import job not found
 */
router.get('/:id', hasPermission('inventory:read'), ImportController.getStatus);

/**
 * @swagger
 * /admin/import/{id}/errors:
 *   get:
 *     summary: Download the error file for a failed/partial import job
 *     tags: [Admin Import]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Error file download
 *         content:
 *           application/octet-stream:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: No error file available
 */
router.get('/:id/errors', hasPermission('inventory:read'), ImportController.getErrors);

module.exports = router;
