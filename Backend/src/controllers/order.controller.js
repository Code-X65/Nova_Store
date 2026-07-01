const OrderService = require('../services/order.service');
const AuditService = require('../services/audit.service');
const PaymentService = require('../services/payment.service');
const InvoiceService = require('../services/invoice.service');
const OrderModel = require('../models/order.model');

class OrderController {
  // ─────────────────────────────────────────────────────────────────────────────
  // Customer endpoints
  // ─────────────────────────────────────────────────────────────────────────────

  async getMyOrders(req, res, next) {
    try {
      const { status, page, limit } = req.query;
      const result = await OrderService.getUserOrders(req.user.id, { status }, { page: page || 1, limit: limit || 10 });
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  async getOrderDetails(req, res, next) {
    try {
      const { id } = req.params;
      const isAdmin = (req.user.role && req.user.role.toUpperCase() === 'ADMIN') ||
                      (req.user.roles && (req.user.roles.includes('admin') || req.user.roles.includes('ADMIN')));
      const order = await OrderService.getOrderDetails(id, req.user.id, isAdmin);
      res.status(200).json({ success: true, data: { order } });
    } catch (error) {
      next(error);
    }
  }

  async cancelOrder(req, res, next) {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const order = await OrderService.cancelOrder(id, req.user.id, reason);
      AuditService.log(req, 'order.cancelled', 'order', id, null, { reason, orderNumber: order.order_number });
      res.status(200).json({ success: true, data: { order }, message: 'Order cancelled successfully' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /orders/:id/return-request
   * Customer requests a return for a delivered order (hard 7-day window).
   */
  async requestReturn(req, res, next) {
    try {
      const { id } = req.params;
      const { reason, evidenceUrls = [], evidenceNotes } = req.body;
      const order = await OrderService.requestReturn(id, req.user.id, reason, evidenceUrls, evidenceNotes);
      AuditService.log(req, 'order.return_requested', 'order', id, null, { reason, orderNumber: order.order_number });
      res.status(200).json({ success: true, data: { order }, message: 'Return requested successfully' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /orders/:id/reorder
   */
  async reorder(req, res, next) {
    try {
      const { id } = req.params;
      const cart = await OrderService.reorder(id, req.user.id);
      AuditService.log(req, 'order.reordered', 'order', id);
      res.status(200).json({ success: true, data: { cart }, message: 'Items added to cart' });
    } catch (error) {
      next(error);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Admin — general order management
  // ─────────────────────────────────────────────────────────────────────────────

  async getAllOrders(req, res, next) {
    try {
      const { status, userId, dateFrom, dateTo, page, limit } = req.query;
      const filters = { status, userId, dateFrom, dateTo };
      const result = await OrderService.getAllOrders(filters, { page: page || 1, limit: limit || 10 });
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /orders/admin/dispatch-queue
   * Returns orders that are in active delivery lifecycle stages.
   */
  async getDispatchQueue(req, res, next) {
    try {
      const { status, deliveryStatus, dateFrom, dateTo, staleSinceMinutes, page, limit } = req.query;
      const result = await OrderService.getDispatchQueue(
        { status, deliveryStatus, dateFrom, dateTo, staleSinceMinutes },
        { page: page || 1, limit: limit || 20 }
      );
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  async updateOrderStatus(req, res, next) {
    try {
      const { id } = req.params;
      const order = await OrderService.updateOrderStatus(id, req.body, req.user.id);
      AuditService.log(req, 'order.status.updated', 'order', id, null, { newStatus: order.status });
      res.status(200).json({ success: true, data: { order }, message: 'Order status updated' });
    } catch (error) {
      next(error);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Admin — manual delivery milestone endpoints
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * POST /orders/admin/:id/ready
   * Mark order as packed and ready for dispatch.
   */
  async markReadyForDispatch(req, res, next) {
    try {
      const { id } = req.params;
      const { note } = req.body;
      const order = await OrderService.markReadyForDispatch(id, note, req.user.id);
      AuditService.log(req, 'order.ready_for_dispatch', 'order', id);
      res.status(200).json({ success: true, data: { order }, message: 'Order marked as ready for dispatch' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /orders/admin/:id/dispatch
   * Assign driver and transition order to dispatched.
   */
  async dispatchOrder(req, res, next) {
    try {
      const { id } = req.params;
      const { driverName, driverPhone, dispatchNotes, deliveryWindow } = req.body;
      const order = await OrderService.dispatchOrder(id, { driverName, driverPhone, dispatchNotes, deliveryWindow }, req.user.id);
      AuditService.log(req, 'order.dispatched', 'order', id, null, { driverName });
      res.status(200).json({ success: true, data: { order }, message: `Order dispatched to driver: ${driverName}` });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /orders/admin/:id/picked-up
   * Record that the driver has physically collected the package.
   */
  async markPickedUp(req, res, next) {
    try {
      const { id } = req.params;
      const { note } = req.body;
      const order = await OrderService.markPickedUp(id, note, req.user.id);
      AuditService.log(req, 'order.picked_up', 'order', id);
      res.status(200).json({ success: true, data: { order }, message: 'Order marked as picked up by driver' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /orders/admin/:id/out-for-delivery
   * Driver is en route to the customer.
   */
  async markOutForDelivery(req, res, next) {
    try {
      const { id } = req.params;
      const { note } = req.body;
      const order = await OrderService.markOutForDelivery(id, note, req.user.id);
      AuditService.log(req, 'order.out_for_delivery', 'order', id);
      res.status(200).json({ success: true, data: { order }, message: 'Order marked as out for delivery' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /orders/admin/:id/delivery-attempted
   * Record a failed delivery attempt.
   */
  async markDeliveryAttempted(req, res, next) {
    try {
      const { id } = req.params;
      const { note } = req.body;
      const order = await OrderService.markDeliveryAttempted(id, note, req.user.id);
      AuditService.log(req, 'order.delivery_attempted', 'order', id, null, { note });
      res.status(200).json({ success: true, data: { order }, message: 'Delivery attempt recorded' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /orders/admin/:id/deliver
   * Mark order as successfully delivered with proof of delivery.
   */
  async deliverOrder(req, res, next) {
    try {
      const { id } = req.params;
      const { podType, podValue, note } = req.body;
      const order = await OrderService.markDelivered(id, { podType, podValue, note }, req.user.id);
      AuditService.log(req, 'order.delivered', 'order', id, null, { podType });
      res.status(200).json({ success: true, data: { order }, message: 'Order marked as delivered' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /orders/admin/:id/returned-to-store
   * Driver returned the undelivered package to the store.
   */
  async markReturnedToStore(req, res, next) {
    try {
      const { id } = req.params;
      const { note } = req.body;
      const order = await OrderService.markReturnedToStore(id, note, req.user.id);
      AuditService.log(req, 'order.returned_to_store', 'order', id, null, { note });
      res.status(200).json({ success: true, data: { order }, message: 'Order marked as returned to store' });
    } catch (error) {
      next(error);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Admin — return processing
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * POST /orders/admin/:id/return
   * Process a return through all stages:
   * review → approve → schedule_pickup → mark_collected → complete_qc → process_refund → complete
   * Or: reject at any early stage.
   */
  async processReturn(req, res, next) {
    try {
      const { id } = req.params;
      const { action, note, refundAmount, qcOutcome, qcNotes } = req.body;

      let order;
      try {
        order = await OrderService.processReturn(id, { action, note, refundAmount, qcOutcome, qcNotes }, req.user.id);
      } catch (err) {
        if (action === 'process_refund') {
          return res.status(502).json({
            success: false,
            message: `Payment gateway refund failed — return not marked as refund_pending. Gateway error: ${err.message}`,
            hint: 'Resolve the gateway issue and retry this action.'
          });
        }
        throw err;
      }

      const actionLabels = {
        review:          'placed under review',
        approve:         'approved',
        reject:          'rejected',
        schedule_pickup: 'pickup scheduled',
        mark_collected:  'item collected',
        complete_qc:     'QC completed',
        process_refund:  'refund initiated',
        complete:        'completed'
      };

      AuditService.log(req, `order.return.${action}`, 'order', id, null, { action, refundAmount, qcOutcome, note });
      res.status(200).json({
        success: true,
        data: { order },
        message: `Return ${actionLabels[action] || action} successfully`
      });
    } catch (error) {
      next(error);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Invoices
  // ─────────────────────────────────────────────────────────────────────────────

  async getInvoice(req, res, next) {
    try {
      const { id } = req.params;
      const isAdmin = (req.user.role && req.user.role.toUpperCase() === 'ADMIN') ||
                      (req.user.roles && (req.user.roles.includes('admin') || req.user.roles.includes('ADMIN')));

      const order = await OrderService.getOrderDetails(id, req.user.id, isAdmin);
      if (!order) {
        return res.status(404).json({ success: false, message: 'Order not found' });
      }

      const pdfBuffer = await InvoiceService.generateInvoicePdf(order, order.items || []);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=invoice-${order.order_number}.pdf`);
      res.status(200).send(pdfBuffer);
    } catch (error) {
      next(error);
    }
  }

  async claimGuestOrders(req, res, next) {
    try {
      const claimed = await OrderService.claimGuestOrders(req.user.id, req.user.email, req);
      res.status(200).json({
        success: true,
        data: {
          claimedCount: claimed.length,
          orders: claimed
        },
        message: `${claimed.length} guest order(s) successfully claimed`
      });
    } catch (error) {
      next(error);
    }
  }

  async bulkAction(req, res, next) {
    try {
      const { orderIds, action, extraData } = req.body;
      const result = await OrderService.bulkOrderAction(orderIds, action, extraData, req.user.id, req);
      res.status(200).json({
        success: true,
        data: result,
        message: `Bulk ${action} execution completed`
      });
    } catch (error) {
      next(error);
    }
  }

  async exportOrders(req, res, next) {
    try {
      const { status, userId, dateFrom, dateTo, format } = req.query;
      const filters = { status, userId, dateFrom, dateTo };

      const fileData = await OrderService.exportOrders(filters, format || 'csv');

      if (format === 'pdf') {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=orders-export-${Date.now()}.pdf`);
      } else {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=orders-export-${Date.now()}.csv`);
      }

      res.status(200).send(fileData);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new OrderController();
