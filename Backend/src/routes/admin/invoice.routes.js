const express = require('express');
const InvoiceController = require('../../controllers/admin/invoice.controller');
const { hasPermission, hasAnyPermission } = require('../../middlewares/permission.middleware');

const router = express.Router();
const controller = InvoiceController;

/**
 * @swagger
 * tags:
 *   - name: Invoices
 *     description: Automated gross-NGN invoicing (Phase 4 §5.2)
 */

/**
 * @swagger
 * /admin/invoices:
 *   get:
 *     summary: List invoices
 *     tags: [Invoices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: orderNumber
 *         schema: { type: string }
 *       - in: query
 *         name: dateFrom
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: dateTo
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Success
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/',
  hasPermission('billing:read'),
  controller.list
);

/**
 * @swagger
 * /admin/invoices/{id}:
 *   get:
 *     summary: Get an invoice by ID
 *     tags: [Invoices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Invoice ID
 *     responses:
 *       200:
 *         description: Success
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 */
router.get('/:id',
  hasPermission('billing:read'),
  controller.getOne
);

/**
 * @swagger
 * /admin/invoices/{id}/pdf:
 *   get:
 *     summary: Download the invoice PDF
 *     tags: [Invoices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Invoice ID
 *     responses:
 *       200:
 *         description: Invoice PDF file stream
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 */
router.get('/:id/pdf',
  hasPermission('billing:read'),
  controller.download
);

/**
 * @swagger
 * /admin/invoices/orders/{id}/generate:
 *   post:
 *     summary: Generate an invoice for an order
 *     tags: [Invoices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Order ID
 *     responses:
 *       200:
 *         description: Invoice generated
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 */
router.post('/orders/:id/generate',
  hasAnyPermission('billing:read', 'order:write'),
  controller.generateForOrder
);

module.exports = router;
