const OrderModel = require('../models/order.model');
const OrderStatusHistoryModel = require('../models/order-status-history.model');
const DeliveryDispatchModel = require('../models/delivery-dispatch.model');
const UserModel = require('../models/user.model');
const CartService = require('./cart.service');
const InventoryService = require('./inventory.service');
const NotificationService = require('./notification.service');
const NotificationTemplateModel = require('../models/notification-template.model');
const logger = require('../utils/logger');

/** Days after delivery within which a return can be requested (hard rule). */
const RETURN_WINDOW_DAYS = 7;

/**
 * Valid return_status values that each action requires the order to currently be in.
 * This prevents illegal state jumps (e.g. complete before QC).
 */
const RETURN_TRANSITIONS = {
  review:          ['requested'],
  approve:         ['requested', 'under_review'],
  reject:          ['requested', 'under_review', 'approved'],
  schedule_pickup: ['approved'],
  mark_collected:  ['pickup_scheduled'],
  complete_qc:     ['collected'],
  process_refund:  ['qc_received'],
  complete:        ['refund_pending']
};

/**
 * Fire a notification if the template exists, else log a warning and continue.
 * All notifications are async (queued) so they never block order operations.
 */
async function fireNotification(userId, templateKey, data = {}) {
  if (!userId) return;
  const tmpl = await NotificationTemplateModel.findByKey(templateKey);
  if (tmpl) {
    await NotificationService.sendToUser(userId, templateKey, data, null, null, { async: true });
  } else {
    logger.warn(`[OrderService] Skipping ${templateKey} notification: template not found`);
  }
}

/**
 * Resolve a user's display name for notification templates.
 * Fails silently — a missing name should never block an order operation.
 */
async function resolveUserName(userId) {
  try {
    const user = await UserModel.findById(userId);
    if (!user) return 'Customer';
    return `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Customer';
  } catch {
    return 'Customer';
  }
}

/**
 * Log a status change to order_status_history.
 */
async function logHistory(orderId, status, note, changedBy) {
  await OrderStatusHistoryModel.create({ order_id: orderId, status, note, changed_by: changedBy });
}

class OrderService {
  // ─────────────────────────────────────────────────────────────────────────────
  // Customer order methods
  // ─────────────────────────────────────────────────────────────────────────────

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
    const dispatches = await DeliveryDispatchModel.findByOrderId(orderId);
    return { ...order, history, dispatches };
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

    const userName = await resolveUserName(order.user_id);
    await fireNotification(order.user_id, 'order_cancelled', {
      userName,
      orderNumber: order.order_number,
      reason: reason || 'Customer request'
    });

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

  // ─────────────────────────────────────────────────────────────────────────────
  // Admin — general order management
  // ─────────────────────────────────────────────────────────────────────────────

  async getAllOrders(filters, pagination) {
    return await OrderModel.findAll(filters, pagination);
  }

  async getDispatchQueue(filters, pagination) {
    return await OrderModel.getDispatchQueue(filters, pagination);
  }

  /**
   * Generic status updater — used for simple transitions the controller exposes.
   */
  async updateOrderStatus(orderId, updateData, adminId) {
    const { status, trackingNumber, carrier, note } = updateData;

    const currentOrder = await OrderModel.findById(orderId);
    if (!currentOrder) throw new Error('Order not found');

    const updatedOrder = await OrderModel.updateStatus(orderId, status, null, note, adminId);

    if (trackingNumber || carrier) {
      await OrderModel.update(orderId, { tracking_number: trackingNumber, carrier });
    }

    await logHistory(orderId, status, note || `Status updated to ${status}`, adminId);

    const userName = await resolveUserName(currentOrder.user_id);

    if (status === 'shipped' && currentOrder.user_id) {
      await fireNotification(currentOrder.user_id, 'order_shipped', {
        userName,
        orderNumber: currentOrder.order_number,
        trackingNumber: trackingNumber || 'N/A',
        carrier: carrier || 'N/A'
      });
    }

    if (status === 'delivered' && currentOrder.user_id) {
      await fireNotification(currentOrder.user_id, 'order_delivered', {
        userName,
        orderNumber: currentOrder.order_number
      });
    }

    return updatedOrder;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Admin — manual delivery milestone methods
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Mark an order as ready for dispatch (warehouse has packed it).
   */
  async markReadyForDispatch(orderId, note, adminId) {
    const order = await OrderModel.findById(orderId);
    if (!order) throw new Error('Order not found');

    const allowed = ['pending', 'confirmed', 'processing'];
    if (!allowed.includes(order.status)) {
      throw new Error(`Cannot mark as ready_for_dispatch from status: ${order.status}`);
    }

    const updatedOrder = await OrderModel.update(orderId, {
      status: 'ready_for_dispatch',
      delivery_status: 'not_dispatched',
      updated_at: new Date().toISOString()
    });

    await logHistory(orderId, 'ready_for_dispatch', note || 'Order packed and ready for dispatch', adminId);
    const userName = await resolveUserName(order.user_id);
    await fireNotification(order.user_id, 'order_processing', { userName, orderNumber: order.order_number });

    return updatedOrder;
  }

  /**
   * Assign a driver and create a dispatch record.
   * Transitions order to status=dispatched, delivery_status=assigned.
   */
  async dispatchOrder(orderId, { driverName, driverPhone, dispatchNotes, deliveryWindow }, adminId) {
    const order = await OrderModel.findById(orderId);
    if (!order) throw new Error('Order not found');

    const allowed = ['confirmed', 'processing', 'ready_for_dispatch'];
    if (!allowed.includes(order.status)) {
      throw new Error(`Cannot dispatch order from status: ${order.status}`);
    }
    if (!driverName) throw new Error('Driver name is required to dispatch');

    const now = new Date().toISOString();

    // Create dispatch record
    await DeliveryDispatchModel.create({
      order_id:      orderId,
      assigned_by:   adminId,
      driver_name:   driverName,
      driver_phone:  driverPhone,
      dispatch_notes: dispatchNotes
    });

    const updatedOrder = await OrderModel.update(orderId, {
      status:               'dispatched',
      delivery_status:      'assigned',
      driver_name:          driverName,
      driver_phone:         driverPhone || null,
      dispatched_at:        now,
      manual_dispatch_notes: dispatchNotes || null,
      delivery_window:      deliveryWindow || null,
      updated_at:           now
    });

    await logHistory(orderId, 'dispatched', `Assigned to driver: ${driverName}`, adminId);
    const userName = await resolveUserName(order.user_id);
    await fireNotification(order.user_id, 'order_dispatched', { userName, orderNumber: order.order_number });

    return updatedOrder;
  }

  /**
   * Driver has physically collected the package.
   */
  async markPickedUp(orderId, note, adminId) {
    const order = await OrderModel.findById(orderId);
    if (!order) throw new Error('Order not found');
    if (order.status !== 'dispatched') {
      throw new Error(`Cannot mark as picked_up from status: ${order.status}`);
    }

    const now = new Date().toISOString();

    await DeliveryDispatchModel.updateStatusByOrderId(orderId, 'picked_up', {
      picked_up_at: now
    });

    const updatedOrder = await OrderModel.update(orderId, {
      delivery_status: 'picked_up',
      updated_at: now
    });

    await logHistory(orderId, 'picked_up', note || 'Driver picked up the package', adminId);

    return updatedOrder;
  }

  /**
   * Driver is en route to the customer.
   * Transitions: status=out_for_delivery, delivery_status=out_for_delivery.
   */
  async markOutForDelivery(orderId, note, adminId) {
    const order = await OrderModel.findById(orderId);
    if (!order) throw new Error('Order not found');

    const allowed = ['dispatched', 'out_for_delivery'];
    if (!allowed.includes(order.status) && order.delivery_status !== 'picked_up') {
      throw new Error(`Cannot mark as out_for_delivery from status: ${order.status}`);
    }

    const now = new Date().toISOString();

    await DeliveryDispatchModel.updateStatusByOrderId(orderId, 'out_for_delivery');

    const updatedOrder = await OrderModel.update(orderId, {
      status:              'out_for_delivery',
      delivery_status:     'out_for_delivery',
      out_for_delivery_at: now,
      updated_at:          now
    });

    await logHistory(orderId, 'out_for_delivery', note || 'Driver is en route', adminId);
    const userName = await resolveUserName(order.user_id);
    await fireNotification(order.user_id, 'order_out_for_delivery', { userName, orderNumber: order.order_number });

    return updatedOrder;
  }

  /**
   * Delivery attempt failed (customer unavailable, wrong address, etc.).
   */
  async markDeliveryAttempted(orderId, note, adminId) {
    const order = await OrderModel.findById(orderId);
    if (!order) throw new Error('Order not found');
    if (order.status !== 'out_for_delivery') {
      throw new Error(`Cannot mark delivery_attempted from status: ${order.status}`);
    }

    const now = new Date().toISOString();

    await DeliveryDispatchModel.updateStatusByOrderId(orderId, 'attempted', { failed_at: now });

    const updatedOrder = await OrderModel.update(orderId, {
      status:          'delivery_attempted',
      delivery_status: 'attempted',
      attempted_at:    now,
      updated_at:      now
    });

    await logHistory(orderId, 'delivery_attempted', note || 'Delivery attempt failed', adminId);
    const userName = await resolveUserName(order.user_id);
    await fireNotification(order.user_id, 'order_delivery_attempted', { userName, orderNumber: order.order_number });

    return updatedOrder;
  }

  /**
   * Order successfully delivered to the customer.
   * Sets return window expiry to delivered_at + RETURN_WINDOW_DAYS.
   */
  async markDelivered(orderId, { podType, podValue, note } = {}, adminId) {
    const order = await OrderModel.findById(orderId);
    if (!order) throw new Error('Order not found');

    const allowed = ['out_for_delivery', 'delivery_attempted', 'dispatched'];
    if (!allowed.includes(order.status)) {
      throw new Error(`Cannot mark as delivered from status: ${order.status}`);
    }

    const now = new Date();
    const returnExpiry = new Date(now);
    returnExpiry.setDate(returnExpiry.getDate() + RETURN_WINDOW_DAYS);

    // Update the dispatch record with proof of delivery
    await DeliveryDispatchModel.updateStatusByOrderId(orderId, 'delivered', {
      delivered_at: now.toISOString(),
      pod_type:     podType || null,
      pod_value:    podValue || null
    });

    const updatedOrder = await OrderModel.update(orderId, {
      status:                   'delivered',
      delivery_status:          'delivered',
      delivered_at:             now.toISOString(),
      return_window_expires_at: returnExpiry.toISOString(),
      updated_at:               now.toISOString()
    });

    await logHistory(orderId, 'delivered', note || 'Order delivered to customer', adminId);
    const userName = await resolveUserName(order.user_id);
    await fireNotification(order.user_id, 'order_delivered', { userName, orderNumber: order.order_number });

    return updatedOrder;
  }

  /**
   * Driver returned the undelivered package to the store.
   * Re-queues the order as 'processing' so admin knows it needs a new delivery attempt.
   */
  async markReturnedToStore(orderId, note, adminId) {
    const order = await OrderModel.findById(orderId);
    if (!order) throw new Error('Order not found');

    const now = new Date().toISOString();

    await DeliveryDispatchModel.updateStatusByOrderId(orderId, 'returned_to_store');

    const updatedOrder = await OrderModel.update(orderId, {
      status:          'processing',   // Re-queued for a new dispatch attempt
      delivery_status: 'returned_to_store',
      updated_at:      now
    });

    await logHistory(orderId, 'returned_to_store', note || 'Package returned to store by driver — awaiting re-dispatch', adminId);

    return updatedOrder;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Customer — return request (with 7-day window enforcement)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Customer initiates a return request.
   * Hard-enforces the 7-day return window from delivered_at.
   */
  async requestReturn(orderId, userId, reason, evidenceUrls = [], evidenceNotes = null) {
    const order = await OrderModel.findById(orderId);
    if (!order) throw new Error('Order not found');
    if (order.user_id !== userId) throw new Error('Unauthorized');

    if (order.status !== 'delivered') {
      throw new Error(`Return can only be requested for delivered orders (current: ${order.status})`);
    }

    // Hard 7-day window enforcement
    if (order.return_window_expires_at) {
      const expiresAt = new Date(order.return_window_expires_at);
      if (new Date() > expiresAt) {
        throw new Error('Return window has expired. Returns must be requested within 7 days of delivery.');
      }
    } else if (order.delivered_at) {
      // Fallback: compute from delivered_at if return_window_expires_at not set
      const expiresAt = new Date(order.delivered_at);
      expiresAt.setDate(expiresAt.getDate() + RETURN_WINDOW_DAYS);
      if (new Date() > expiresAt) {
        throw new Error('Return window has expired. Returns must be requested within 7 days of delivery.');
      }
    }

    if (order.return_status && order.return_status !== 'rejected') {
      throw new Error(`A return has already been requested for this order (status: ${order.return_status})`);
    }

    const updatedOrder = await OrderModel.update(orderId, {
      return_status:         'requested',
      return_reason:         reason,
      return_evidence_urls:  evidenceUrls.length > 0 ? evidenceUrls : null,
      return_evidence_notes: evidenceNotes || null,
      status:                'returned'
    });

    await logHistory(orderId, 'returned', `Return requested by customer: ${reason || 'No reason given'}`, userId);
    const userName = await resolveUserName(order.user_id);
    await fireNotification(order.user_id, 'return_requested', {
      userName,
      orderNumber: order.order_number,
      reason: reason || 'Customer request'
    });

    return updatedOrder;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Admin — full reverse-logistics return processing
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Process a return through its full lifecycle.
   *
   * Supported actions:
   *   review          → return_status = under_review
   *   approve         → return_status = approved
   *   reject          → return_status = rejected
   *   schedule_pickup → return_status = pickup_scheduled
   *   mark_collected  → return_status = collected  + sets return_collected_at
   *   complete_qc     → return_status = qc_received + saves qc_outcome/qc_notes
   *                     if qc_outcome === 'sellable', restores inventory
   *   process_refund  → return_status = refund_pending
   *   complete        → return_status = refund_completed + sets refunded_at
   */
  async processReturn(orderId, { action, note, refundAmount, qcOutcome, qcNotes }, adminId) {
    const order = await OrderModel.findById(orderId);
    if (!order) throw new Error('Order not found');

    const validActions = ['review', 'approve', 'reject', 'schedule_pickup', 'mark_collected', 'complete_qc', 'process_refund', 'complete'];
    if (!validActions.includes(action)) {
      throw new Error(`Invalid return action: ${action}. Valid: ${validActions.join(', ')}`);
    }

    // Fix 1: Enforce valid state transitions
    const allowedCurrentStatuses = RETURN_TRANSITIONS[action];
    if (!allowedCurrentStatuses.includes(order.return_status)) {
      throw new Error(
        `Invalid return transition: cannot perform '${action}' when return_status is '${order.return_status}'. ` +
        `Order must be in one of: [${allowedCurrentStatuses.join(', ')}]`
      );
    }

    const now = new Date().toISOString();

    const statusMap = {
      review:          'under_review',
      approve:         'approved',
      reject:          'rejected',
      schedule_pickup: 'pickup_scheduled',
      mark_collected:  'collected',
      complete_qc:     'qc_received',
      process_refund:  'refund_pending',
      complete:        'refund_completed'
    };

    const returnStatus = statusMap[action];
    const updateData = { return_status: returnStatus };

    if (refundAmount != null)    updateData.refund_amount = refundAmount;
    if (action === 'mark_collected') updateData.return_collected_at = now;
    if (action === 'complete') {
      updateData.status        = 'refunded';   // Fix 6: align order lifecycle
      updateData.refund_status = 'completed';
      updateData.refunded_at   = now;
    }

    if (action === 'complete_qc') {
      if (!qcOutcome) throw new Error('qcOutcome is required for complete_qc action');
      const validQcOutcomes = ['sellable', 'damaged', 'quarantine', 'discard'];
      if (!validQcOutcomes.includes(qcOutcome)) {
        throw new Error(`Invalid qcOutcome: ${qcOutcome}. Valid: ${validQcOutcomes.join(', ')}`);
      }
      updateData.qc_outcome = qcOutcome;
      updateData.qc_notes   = qcNotes || null;

      // Restore inventory only for sellable items
      if (qcOutcome === 'sellable' && order.items) {
        for (const item of order.items) {
          await InventoryService.addStock(
            item.product_id,
            item.quantity,
            orderId,
            'return',
            `Order ${order.order_number} return QC passed — sellable stock reintegrated`
          );
        }
      }
    }

    const updatedOrder = await OrderModel.update(orderId, updateData);

    await logHistory(orderId, returnStatus, note || `Return ${returnStatus} by admin`, adminId);

    // Fix 4: resolve userName for notification templates
    const userName = await resolveUserName(order.user_id);

    // Notification map
    const notificationMap = {
      review:          'return_under_review',
      approve:         'return_approved',
      reject:          'return_rejected',
      schedule_pickup: 'return_pickup_scheduled',
      mark_collected:  'return_collected',
      process_refund:  'return_refund_pending',
      complete:        'return_refund_completed'
    };

    const templateKey = notificationMap[action];
    if (templateKey && order.user_id) {
      await fireNotification(order.user_id, templateKey, {
        userName,
        orderNumber:  order.order_number,
        refundAmount: refundAmount ? `₦${refundAmount}` : undefined,
        action
      });
    }

    return updatedOrder;
  }
}

module.exports = new OrderService();
