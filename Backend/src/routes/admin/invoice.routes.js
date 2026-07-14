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

router.get('/',
  hasPermission('billing:read'),
  controller.list
);

router.get('/:id',
  hasPermission('billing:read'),
  controller.getOne
);

router.get('/:id/pdf',
  hasPermission('billing:read'),
  controller.download
);

router.post('/orders/:id/generate',
  hasAnyPermission('billing:read', 'order:write'),
  controller.generateForOrder
);

module.exports = router;
