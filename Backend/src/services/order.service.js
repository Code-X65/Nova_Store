const OrderModel = require('../models/order.model');
const OrderStatusHistoryModel = require('../models/order-status-history.model');
const CartService = require('./cart.service');
const InventoryService = require('./inventory.service');
const NotificationService = require('./notification.service');
const NotificationTemplateModel = require('../models/notification-template.model');
const logger = require('../utils/logger');

class OrderService {
  async getUserOrders(userId, filters, pagination) {
    return await OrderModel.findByUserId(userId, filters, pagination);
  }

  async getOrderDetails(orderId, userId = null, isAdmin = false) {
    const order = await OrderModel.findById(orderId);
    if (!order) throw new Error('Order not found');

    if (!isAdmin && order.user_id !== userId) {
      throw new Error('Unauthorized access to order');
    }

    const history = await OrderStatusHistoryModel.findByOrderId(orderId);
    return { ...order, history };
  }

  async cancelOrder(orderId, userId, reason) {
    const order = await OrderModel.findById(orderId);
    if (!order) throw new Error('Order not found');
    if (order.user_id !== userId) throw new Error('Unauthorized');

    const nonCancellableStates = ['shipped', 'delivered', 'cancelled', 'returned', 'refunded'];
    if (nonCancellableStates.includes(order.status)) {
      throw new Error(`Order cannot be cancelled in current status: ${order.status}`);
    }

    const updatedOrder = await OrderModel.updateStatus(orderId, 'cancelled', null, `Cancelled by user: ${reason}`, userId);

    // Restore inventory
    for (const item of order.items) {
      await InventoryService.addStock(item.product_id, item.quantity, orderId, 'return', `Order ${order.order_number} cancelled`);
    }

    // Send notification only if template exists
    if (order.user_id) {
      const tmpl = await NotificationTemplateModel.findByKey('order_cancelled');
      if (tmpl) {
        await NotificationService.sendToUser(order.user_id, 'order_cancelled', {
          orderNumber: order.order_number,
          reason: reason || 'Customer request'
        }, null, null, { async: true });
      } else {
        logger.warn(`Skipping order_cancelled notification: template not found for order ${order.order_number}`);
      }
    }

    return updatedOrder;
  }

  async reorder(orderId, userId) {
    const order = await OrderModel.findById(orderId);
    if (!order) throw new Error('Order not found');

    for (const item of order.items) {
      await CartService.addItem(userId, null, item.product_id, item.variant_id, item.quantity);
    }

    return await CartService.getOrCreateCart(userId, null);
  }

  async getAllOrders(filters, pagination) {
    return await OrderModel.findAll(filters, pagination);
  }

  async updateOrderStatus(orderId, updateData, adminId) {
    const { status, trackingNumber, carrier, note } = updateData;

    const currentOrder = await OrderModel.findById(orderId);
    if (!currentOrder) throw new Error('Order not found');

    const updatedOrder = await OrderModel.updateStatus(orderId, status, null, note, adminId);

    if (trackingNumber || carrier) {
      await OrderModel.update(orderId, { tracking_number: trackingNumber, carrier: carrier });
    }

    await OrderStatusHistoryModel.create({
      order_id: orderId,
      status: status,
      note: note || `Status updated to ${status}`,
      changed_by: adminId
    });

    // Shipment notification with template guard
    if (status === 'shipped' && currentOrder.user_id) {
      const tmpl = await NotificationTemplateModel.findByKey('order_shipped');
      if (tmpl) {
        await NotificationService.sendToUser(currentOrder.user_id, 'order_shipped', {
          orderNumber: currentOrder.order_number,
          trackingNumber: trackingNumber || 'N/A',
          carrier: carrier || 'N/A'
        }, null, null, { async: true });
      } else {
        logger.warn(`Skipping order_shipped notification: template not found for order ${currentOrder.order_number}`);
      }
    }

    // Delivery notification with template guard
    if (status === 'delivered' && currentOrder.user_id) {
      const tmpl = await NotificationTemplateModel.findByKey('order_delivered');
      if (tmpl) {
        await NotificationService.sendToUser(currentOrder.user_id, 'order_delivered', {
          orderNumber: currentOrder.order_number
        }, null, null, { async: true });
      } else {
        logger.warn(`Skipping order_delivered notification: template not found for order ${currentOrder.order_number}`);
      }
    }

    return updatedOrder;
  }

  /**
   * User-initiated return request for a delivered/cancelled order.
   */
  async requestReturn(orderId, userId, reason) {
    const order = await OrderModel.findById(orderId);
    if (!order) throw new Error('Order not found');
    if (order.user_id !== userId) throw new Error('Unauthorized');

    const allowedReturnStatuses = ['delivered', 'cancelled'];
    if (!allowedReturnStatuses.includes(order.status)) {
      throw new Error(`Return cannot be requested for order with status: ${order.status}`);
    }
    if (order.return_status && order.return_status !== 'rejected') {
      throw new Error(`A return has already been requested for this order. Status: ${order.return_status}`);
    }

    const updateData = {
      return_status: 'requested',
      return_reason: reason,
      status: 'returned'
    };
    const updatedOrder = await OrderModel.update(orderId, updateData);

    await OrderStatusHistoryModel.create({
      order_id: orderId,
      status: 'returned',
      note: `Return requested by customer: ${reason || 'No reason given'}`,
      changed_by: userId
    });

    // Send notification only if template exists
    if (order.user_id) {
      const tmpl = await NotificationTemplateModel.findByKey('return_requested');
      if (tmpl) {
        await NotificationService.sendToUser(order.user_id, 'return_requested', {
          orderNumber: order.order_number,
          reason: reason || 'Customer request'
        }, null, null, { async: true });
      } else {
        logger.warn(`Skipping return_requested notification: template not found for order ${order.order_number}`);
      }
    }

    return updatedOrder;
  }

  /**
   * Admin processes a return request: approve | reject | complete
   */
  async processReturn(orderId, { action, note, refundAmount }, adminId) {
    const order = await OrderModel.findById(orderId);
    if (!order) throw new Error('Order not found');

    const validActions = ['approve', 'reject', 'complete'];
    if (!validActions.includes(action)) {
      throw new Error(`Invalid return action: ${action}`);
    }

    const statusMap = { approve: 'approved', reject: 'rejected', complete: 'completed' };
    const returnStatus = statusMap[action];

    const updateData = { return_status: returnStatus };
    if (refundAmount != null) {
      updateData.refund_amount = refundAmount;
    }

    if (action === 'complete') {
      updateData.refund_status = 'completed';
      updateData.refunded_at = new Date().toISOString();
    }

    const updatedOrder = await OrderModel.update(orderId, updateData);

    await OrderStatusHistoryModel.create({
      order_id: orderId,
      status: returnStatus,
      note: note || `Return ${returnStatus} by admin`,
      changed_by: adminId
    });

    // Send notification only if template exists
    if (order.user_id) {
      const templateKey = `return_${returnStatus}`;
      const tmpl = await NotificationTemplateModel.findByKey(templateKey);
      if (tmpl) {
        await NotificationService.sendToUser(order.user_id, templateKey, {
          orderNumber: order.order_number,
          action
        }, null, null, { async: true });
      } else {
        logger.warn(`Skipping ${templateKey} notification: template not found for order ${order.order_number}`);
      }
    }

    return updatedOrder;
  }
}

module.exports = new OrderService();
