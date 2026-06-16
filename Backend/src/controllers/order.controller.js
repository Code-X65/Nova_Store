const OrderService = require('../services/order.service');
const AuditService = require('../services/audit.service');
const PaymentService = require('../services/payment.service');
const InvoiceService = require('../services/invoice.service');

class OrderController {
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
   * Customer requests a return for a delivered order.
   */
  async requestReturn(req, res, next) {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const order = await OrderService.requestReturn(id, req.user.id, reason);
      AuditService.log(req, 'order.return_requested', 'order', id, null, { reason, orderNumber: order.order_number });
      res.status(200).json({ success: true, data: { order }, message: 'Return requested successfully' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /orders/:id/reorder
   * Reorder items from previous order
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

  /**
   * POST /orders/admin/:id/return
   * Admin processes a return (approve / reject / complete)
   * Body: { action: 'approve' | 'reject' | 'complete', note?: string, refundAmount?: number }
   */
  async processReturn(req, res, next) {
    try {
      const { id } = req.params;
      const { action, note, refundAmount } = req.body;
      const order = await OrderService.processReturn(id, { action, note, refundAmount }, req.user.id);
      
      if (action === 'complete' && refundAmount > 0) {
        try {
          await PaymentService.refundPayment(id, refundAmount, note || 'Refund for completed return');
        } catch (refundErr) {
          console.error(`[OrderController] Gateway refund failed for order ${id} during return completion:`, refundErr.message);
        }
      }

      const actionMessages = { approve: 'approved', reject: 'rejected', complete: 'completed' };
      AuditService.log(req, `order.return.${actionMessages[action]}`, 'order', id, null, { action, refundAmount, note });
      res.status(200).json({ success: true, data: { order }, message: `Return ${actionMessages[action]} successfully` });
    } catch (error) {
      next(error);
    }
  }

  // Admin Controllers
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

  async shipOrder(req, res, next) {
    try {
      const { id } = req.params;
      const { trackingNumber, carrier, note } = req.body;
      const order = await OrderService.markShipped(id, trackingNumber, carrier, note, req.user.id);
      AuditService.log(req, 'order.shipped', 'order', id, null, { trackingNumber, carrier });
      res.status(200).json({ success: true, data: { order }, message: 'Order marked as shipped' });
    } catch (error) {
      next(error);
    }
  }

  async deliverOrder(req, res, next) {
    try {
      const { id } = req.params;
      const { note } = req.body;
      const order = await OrderService.markDelivered(id, note, req.user.id);
      AuditService.log(req, 'order.delivered', 'order', id);
      res.status(200).json({ success: true, data: { order }, message: 'Order marked as delivered' });
    } catch (error) {
      next(error);
    }
  }

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
}

module.exports = new OrderController();
