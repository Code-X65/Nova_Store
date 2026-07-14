const express = require('express');
const orderController = require('../controllers/order.controller');
const { protect } = require('../middlewares/auth.middleware');
const { hasPermission, hasAnyPermission } = require('../middlewares/permission.middleware');
const validate = require('../middlewares/validate.middleware');
const deliveryValidator = require('../validators/delivery.validator');
const returnEvidenceRouter = require('./order-return-evidence.routes');
const requireOrderStaff = require('../middlewares/require-order-staff.middleware');
const requireManager = require('../middlewares/require-manager.middleware');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Orders
 *   description: Customer order management and admin delivery operations
 */

router.use(protect);

// ── Customer routes ─────────────────────────────────────────────────────────

/**
 * @swagger
 * /orders:
 *   get:
 *     summary: Get current user's orders
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 */
router.get('/', orderController.getMyOrders);

/**
 * @swagger
 * /orders/{id}/invoice:
 *   get:
 *     summary: Download PDF invoice for an order
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:id/invoice', orderController.getInvoice);

/**
 * @swagger
 * /orders/{id}:
 *   get:
 *     summary: Get order details (includes dispatch history)
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:id', orderController.getOrderDetails);

/**
 * @swagger
 * /orders/{id}/cancel:
 *   post:
 *     summary: Cancel an order
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason: { type: string }
 */
router.post('/:id/cancel', orderController.cancelOrder);

/**
 * @swagger
 * /orders/{id}/return-request:
 *   post:
 *     summary: Request a return (must be within 7 days of delivery)
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reason]
 *             properties:
 *               reason:         { type: string, minLength: 5 }
 *               evidenceUrls:   { type: array, items: { type: string, format: uri } }
 *               evidenceNotes:  { type: string }
 */
router.post('/:id/return-request',
  validate(deliveryValidator.requestReturn),
  orderController.requestReturn
);

/**
 * @swagger
 * /orders/{id}/return-evidence:
 *   post:
 *     summary: Upload return evidence photos (max 5 files, images only)
 *     tags: [Orders]
 */
router.use('/:id/return-evidence', returnEvidenceRouter);

/**
 * @swagger
 * /orders/{id}/reorder:
 *   post:
 *     summary: Re-add items from a previous order to cart
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:id/reorder', orderController.reorder);

// ── Admin routes ─────────────────────────────────────────────────────────────

/**
 * @swagger
 * /orders/admin/list:
 *   get:
 *     summary: List all orders (Admin)
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 */
router.get('/admin/list', hasAnyPermission('order:read', 'sales:read'), orderController.getAllOrders);
router.get('/admin/export', hasAnyPermission('order:read', 'sales:read'), orderController.exportOrders);

/**
 * @swagger
 * /orders/admin/dispatch-queue:
 *   get:
 *     summary: View the live dispatch queue — orders in active delivery stages
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *         description: Filter by order status (e.g. ready_for_dispatch, dispatched)
 *       - in: query
 *         name: deliveryStatus
 *         schema: { type: string }
 *         description: Filter by delivery_status column (e.g. not_dispatched, assigned)
 *       - in: query
 *         name: staleSinceMinutes
 *         schema: { type: integer }
 *         description: Filter for orders stale/not updated for at least this many minutes (SLA window)
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 */
router.get('/admin/dispatch-queue', requireOrderStaff, orderController.getDispatchQueue);

/**
 * @swagger
 * /orders/admin/{id}:
 *   patch:
 *     summary: Generic order status update (Admin)
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Order ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status: { type: string }
 *               trackingNumber: { type: string }
 *               carrier: { type: string }
 *               note: { type: string }
 */
router.get('/admin/:id', requireOrderStaff, orderController.getOrderDetails);
router.patch('/admin/:id', requireOrderStaff, orderController.updateOrderStatus);

/**
 * @swagger
 * /orders/admin/{id}/ready:
 *   post:
 *     summary: Mark order as packed and ready for dispatch
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Order ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               note: { type: string }
 */
router.post('/admin/:id/ready',
  requireOrderStaff,
  validate(deliveryValidator.deliveryMilestoneNote),
  orderController.markReadyForDispatch
);

/**
 * @swagger
 * /orders/admin/{id}/dispatch:
 *   post:
 *     summary: Assign a driver and dispatch the order
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Order ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [driverName]
 *             properties:
 *               driverName:     { type: string }
 *               driverPhone:    { type: string }
 *               dispatchNotes:  { type: string }
 *               deliveryWindow: { type: string, enum: [morning, afternoon, evening, custom] }
 */
router.post('/admin/:id/dispatch',
  requireOrderStaff,
  validate(deliveryValidator.dispatchOrder),
  orderController.dispatchOrder
);

/**
 * @swagger
 * /orders/admin/{id}/picked-up:
 *   post:
 *     summary: Record that the driver collected the package
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Order ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               note: { type: string }
 */
router.post('/admin/:id/picked-up',
  requireOrderStaff,
  validate(deliveryValidator.deliveryMilestoneNote),
  orderController.markPickedUp
);

/**
 * @swagger
 * /orders/admin/{id}/out-for-delivery:
 *   post:
 *     summary: Mark order as out for delivery (driver en route)
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Order ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               note: { type: string }
 */
router.post('/admin/:id/out-for-delivery',
  requireOrderStaff,
  validate(deliveryValidator.deliveryMilestoneNote),
  orderController.markOutForDelivery
);

/**
 * @swagger
 * /orders/admin/{id}/delivery-attempted:
 *   post:
 *     summary: Record a failed delivery attempt
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Order ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               note: { type: string }
 */
router.post('/admin/:id/delivery-attempted',
  requireOrderStaff,
  validate(deliveryValidator.deliveryMilestoneNote),
  orderController.markDeliveryAttempted
);

/**
 * @swagger
 * /orders/admin/{id}/deliver:
 *   post:
 *     summary: Mark order as delivered with proof of delivery
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Order ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               podType:  { type: string, enum: [otp, signature, photo_reference, driver_confirmation] }
 *               podValue: { type: string }
 *               note:     { type: string }
 */
router.post('/admin/:id/deliver',
  requireOrderStaff,
  validate(deliveryValidator.markDelivered),
  orderController.deliverOrder
);

/**
 * @swagger
 * /orders/admin/{id}/returned-to-store:
 *   post:
 *     summary: Mark order as returned to store by driver (undelivered). Re-queues the order back to 'processing' status.
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Order ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               note: { type: string }
 */
router.post('/admin/:id/returned-to-store',
  requireOrderStaff,
  validate(deliveryValidator.deliveryMilestoneNote),
  orderController.markReturnedToStore
);

/**
 * @swagger
 * /orders/admin/{id}/return:
 *   post:
 *     summary: Process a customer return through all stages. Enforces strict state transitions.
 *     description: |
 *       Enforces the following return state-transition guardrails:
 *       * **review** requires current status: `requested`
 *       * **approve** requires current status: `requested`, `under_review`
 *       * **reject** requires current status: `requested`, `under_review`, `approved`
 *       * **schedule_pickup** requires current status: `approved`
 *       * **mark_collected** requires current status: `pickup_scheduled`
 *       * **complete_qc** requires current status: `collected`. Reintegrates inventory if `qcOutcome` is `sellable`.
 *       * **process_refund** requires current status: `qc_received`
 *       * **complete** requires current status: `refund_pending`. Payment gateway refund must succeed before calling this endpoint (blocks completion if payment gateway fails).
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Order ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [action]
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [review, approve, reject, schedule_pickup, mark_collected, complete_qc, process_refund, complete]
 *               note:         { type: string }
 *               refundAmount: { type: number }
 *               qcOutcome:    { type: string, enum: [sellable, damaged, quarantine, discard] }
 *               qcNotes:      { type: string }
 */
router.post('/admin/:id/return',
  requireManager,
  validate(deliveryValidator.processReturn),
  orderController.processReturn
);

/**
 * @swagger
 * /orders/admin/{id}/complete:
 *   post:
 *     summary: Mark a delivered order as completed (terminal state)
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: note
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Order marked as completed
 */
router.post('/admin/:id/complete',
  requireOrderStaff,
  orderController.completeOrder
);

// Legacy alias — ship endpoint forwards to the generic status updater
router.post('/admin/:id/ship', requireOrderStaff, orderController.updateOrderStatus);

/**
 * @swagger
 * /orders/claim-guest-orders:
 *   post:
 *     summary: Claim guest checkout orders associated with the user's verified email
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Guest orders claimed successfully
 *       400:
 *         description: Email not verified or missing
 */
router.post('/claim-guest-orders', orderController.claimGuestOrders);

/**
 * @swagger
 * /orders/admin/bulk-action:
 *   post:
 *     summary: Perform bulk status actions on multiple orders (Admin only)
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [orderIds, action]
 *             properties:
 *               orderIds:
 *                 type: array
 *                 items: { type: string, format: uuid }
 *               action:
 *                 type: string
 *                 enum: [pack, dispatch, deliver, cancel]
 *               extraData:
 *                 type: object
 *     responses:
 *       200:
 *         description: Bulk action executed successfully
 */
router.post('/admin/bulk-action',
  requireOrderStaff,
  validate(deliveryValidator.bulkOrderAction),
  orderController.bulkAction
);

/**
 * @swagger
 * /orders/admin/bulk-assign-rider:
 *   post:
 *     summary: Assign a rider to multiple orders at once (Manager only)
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [orderIds, riderId]
 *             properties:
 *               orderIds:
 *                 type: array
 *                 items: { type: string, format: uuid }
 *               riderId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       200:
 *         description: Rider assigned to orders
 */
router.post('/admin/bulk-assign-rider',
  requireManager,
  validate(deliveryValidator.bulkAssignRider),
  orderController.bulkAssignRider
);

module.exports = router;
