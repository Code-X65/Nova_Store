const OrderModel = require('../models/order.model');
const OrderStatusHistoryModel = require('../models/order-status-history.model');
const DeliveryDispatchModel = require('../models/delivery-dispatch.model');
const UserModel = require('../models/user.model');
const CartService = require('./cart.service');
const InventoryService = require('./inventory.service');
const NotificationService = require('./notification.service');
const PaymentService = require('./payment.service');
const CouponService = require('./coupon.service');
const CouponModel = require('../models/coupon.model');
const OrderStateMachine = require('./order-state-machine.service');
const NotificationTemplateModel = require('../models/notification-template.model');
const logger = require('../utils/logger');
const AuditService = require('./audit.service');
const SettingService = require('./setting.service');
const eventBus = require('../realtime/event-bus');
const { SINGLE_STORE_ID } = require('../config/store');

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
    return await OrderModel.findByUserId(userId, filters, pagination, SINGLE_STORE_ID);
  }

  async getOrderDetails(orderId, userId = null, isAdmin = false) {
    const order = await OrderModel.findById(orderId, SINGLE_STORE_ID);
    if (!order) throw new Error('Order not found');

    if (!isAdmin && order.user_id !== userId) {
      throw new Error('Unauthorized access to order');
    }

    const history = await OrderStatusHistoryModel.findByOrderId(orderId);
    const dispatches = await DeliveryDispatchModel.findByOrderId(orderId);
    return { ...order, history, dispatches };
  }

  async cancelOrder(orderId, userId, reason, isAdmin = false) {
    const order = await OrderModel.findById(orderId, SINGLE_STORE_ID);
    if (!order) throw new Error('Order not found');
    if (!isAdmin && order.user_id !== userId) throw new Error('Unauthorized');

    if (isAdmin) {
      const { roles } = await UserModel.getUserRolesAndPermissions(userId);
      const isOrderStaffOnly = roles.includes('ORDER_STAFF') && !roles.some(r => ['STORE_OWNER', 'MANAGER'].includes(r));
      if (isOrderStaffOnly) {
        const error = new Error('Order Staff are not authorized to cancel orders');
        error.statusCode = 403;
        throw error;
      }
    }

    await OrderStateMachine.assertAllowed(order.status, 'cancelled');

    const cancelNote = isAdmin ? `Cancelled by admin: ${reason}` : `Cancelled by user: ${reason}`;
    const updatedOrder = await OrderModel.updateStatus(orderId, 'cancelled', null, cancelNote, userId);

    // Restore inventory. Only orders that reached 'paid' ever had stock_quantity
    // actually decremented (via commit_reserved_stock on successful payment) —
    // for those, add the stock back. An unpaid order only ever held a
    // reserved_quantity hold, never touched stock_quantity, so it must be
    // released instead of restocked — calling addStock here would inflate
    // stock_quantity with units that were never actually deducted.
    if (order.payment_status === 'paid') {
      for (const item of order.items) {
        await InventoryService.addStock(
          item.product_id,
          item.quantity,
          userId,
          `Order ${order.order_number} cancelled`,
          item.variant_id
        );
      }
    } else if (order.checkout_session_id) {
      await PaymentService.releaseReservations(order.checkout_session_id);
    }

    // Release any coupon usage claimed at checkout — the order was never paid,
    // so this claim must not permanently consume the coupon's usage slot.
    if (order.coupon_id && order.payment_status !== 'paid') {
      try {
        await CouponService.releaseCouponUsage(order.coupon_id, order.id);
      } catch (couponErr) {
        logger.warn(`[OrderService] Failed to release coupon usage for order ${order.id}: ${couponErr.message}`);
      }
    }

    const userName = await resolveUserName(order.user_id);
    await fireNotification(order.user_id, 'order_cancelled', {
      userName,
      orderNumber: order.order_number,
      reason: reason || (isAdmin ? 'Admin action' : 'Customer request')
    });

    eventBus.emit('order.cancelled', {
      actor: { id: userId, fullName: await resolveUserName(userId), role: isAdmin ? 'admin' : 'customer' },
      resourceType: 'order',
      resourceId: orderId,
      actionType: 'STATUS_CHANGE',
      severity: 'warning',
      title: 'Order cancelled',
      message: `Order #${order.order_number} was cancelled${isAdmin ? ' by admin' : ' by customer'}.`,
      data: { orderId, orderNumber: order.order_number, reason: reason || (isAdmin ? 'Admin action' : 'Customer request'), isAdmin },
      deepLink: `/orders/${orderId}`,
    });

    return updatedOrder;
  }

  async reorder(orderId, userId) {
    const order = await OrderModel.findById(orderId, SINGLE_STORE_ID);
    if (!order) throw new Error('Order not found');

    for (const item of order.items) {
      await CartService.addItem(userId, null, item.product_id, item.variant_id, item.quantity, SINGLE_STORE_ID);
    }

    return await CartService.getOrCreateCart(userId, null, SINGLE_STORE_ID);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Admin — general order management
  // ─────────────────────────────────────────────────────────────────────────────

  async getAllOrders(filters, pagination) {
    const effectiveFilters = { ...filters };
    effectiveFilters.store_id = SINGLE_STORE_ID;
    return await OrderModel.findAll(effectiveFilters, pagination);
  }

  async getDispatchQueue(filters, pagination) {
    const effectiveFilters = { ...filters };
    effectiveFilters.store_id = SINGLE_STORE_ID;
    return await OrderModel.getDispatchQueue(effectiveFilters, pagination);
  }

  /**
   * Generic status updater — used for simple transitions the controller exposes.
   */
  async updateOrderStatus(orderId, updateData, adminId) {
    const { status, trackingNumber, carrier, note } = updateData;

    const currentOrder = await OrderModel.findById(orderId, SINGLE_STORE_ID);
    if (!currentOrder) throw new Error('Order not found');

    // Universal legality check — applies to every role, including STORE_OWNER/
    // MANAGER, who previously had zero transition validation on this generic
    // endpoint and could set status to anything (e.g. reviving a cancelled order).
    await OrderStateMachine.assertAllowed(currentOrder.status, status);

    const { roles } = await UserModel.getUserRolesAndPermissions(adminId);
    const isOrderStaffOnly = roles.includes('ORDER_STAFF') && !roles.some(r => ['STORE_OWNER', 'MANAGER'].includes(r));

    if (isOrderStaffOnly) {
      const allowedTransitions = [
        'pending->confirmed',
        'pending->processing',
        'confirmed->processing',
        'confirmed->ready_for_dispatch',
        'processing->ready_for_dispatch',
        'ready_for_dispatch->dispatched',
        'dispatched->out_for_delivery',
        'dispatched->delivered',
        'out_for_delivery->delivered',
        'out_for_delivery->delivery_attempted',
        'out_for_delivery->processing',
        'delivery_attempted->out_for_delivery',
        'delivery_attempted->delivered',
        'delivery_attempted->processing'
      ];
      const transition = `${currentOrder.status}->${status}`;
      if (!allowedTransitions.includes(transition)) {
        const error = new Error(`Order Staff are not authorized to transition order status from '${currentOrder.status}' to '${status}'`);
        error.statusCode = 403;
        throw error;
      }
    }

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
    const order = await OrderModel.findById(orderId, SINGLE_STORE_ID);
    if (!order) throw new Error('Order not found');

    await OrderStateMachine.assertAllowed(order.status, 'ready_for_dispatch');

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
   * Accepts optional rider_id for structured rider assignment.
   */
  async dispatchOrder(orderId, { riderId, riderName, riderPhone, driverName, driverPhone, dispatchNotes, deliveryWindow, paymentMethod }, adminId) {
    const order = await OrderModel.findById(orderId, SINGLE_STORE_ID);
    if (!order) throw new Error('Order not found');

    if (!driverName) throw new Error('Driver name is required to dispatch');

    if (!await OrderStateMachine.isAllowed(order.status, 'dispatched')) {
      throw new Error(`Cannot dispatch order unless it is ready for dispatch (current status: ${order.status}). Please mark the order as ready first.`);
    }

    const storeModel = require('../models/store.model');
    const storeService = require('./store.service');
    const storeProfile = await storeService.getStoreProfile(SINGLE_STORE_ID);
    const podEnabled = storeProfile?.settings?.['payment.pay_on_delivery_enabled'] === 'true';

    if (paymentMethod && ['pay_on_delivery', 'cod'].includes(paymentMethod) && !podEnabled) {
      throw new Error('Pay on Delivery is not enabled for this store');
    }

    const now = new Date().toISOString();

    let resolvedRiderName = riderName || null;
    const resolvedRiderPhone = riderPhone || null;

    if (riderId && !resolvedRiderName) {
      const RiderModel = require('../models/rider.model');
      const rider = await RiderModel.findById(riderId);
      if (!rider) {
        throw new Error('Selected rider not found');
      }
      if (!rider.is_active) {
        throw new Error('Cannot assign an inactive rider');
      }
      resolvedRiderName = `${rider.first_name} ${rider.last_name}`;
    }

    const finalDriverName = riderId ? resolvedRiderName : driverName;
    const finalDriverPhone = riderId ? (resolvedRiderPhone || (riderId ? null : driverPhone)) : driverPhone;

    await DeliveryDispatchModel.create({
      order_id:      orderId,
      assigned_by:   adminId,
      driver_name:   driverName,
      driver_phone:  driverPhone,
      rider_id:      riderId || null,
      rider_name:    resolvedRiderName,
      rider_phone:   resolvedRiderPhone,
      dispatch_notes: dispatchNotes
    });

    const updateData = {
      status:               'dispatched',
      delivery_status:      'assigned',
      driver_name:          driverName,
      driver_phone:         driverPhone || null,
      rider_id:             riderId || null,
      rider_name:           resolvedRiderName,
      rider_phone:          resolvedRiderPhone,
      dispatched_at:        now,
      manual_dispatch_notes: dispatchNotes || null,
      delivery_window:      deliveryWindow || null,
      updated_at:           now
    };

    if (paymentMethod) {
      updateData.payment_method = paymentMethod;
    }

    const updatedOrder = await OrderModel.update(orderId, updateData);

    await logHistory(orderId, 'dispatched', `Assigned to rider: ${resolvedRiderName || riderId || driverName}`, adminId);
    const userName = await resolveUserName(order.user_id);
    await fireNotification(order.user_id, 'order_dispatched', { userName, orderNumber: order.order_number });

    return updatedOrder;
  }

  /**
   * Driver has physically collected the package.
   */
  async markPickedUp(orderId, note, adminId) {
    const order = await OrderModel.findById(orderId, SINGLE_STORE_ID);
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
    const order = await OrderModel.findById(orderId, SINGLE_STORE_ID);
    if (!order) throw new Error('Order not found');

    await OrderStateMachine.assertAllowed(order.status, 'out_for_delivery');

    const allowedDeliveryStatuses = {
      'dispatched': 'picked_up',
      'delivery_attempted': 'attempted'
    };
    if (order.delivery_status !== allowedDeliveryStatuses[order.status]) {
      throw new Error(`Cannot mark as out_for_delivery from delivery status: ${order.delivery_status} (order status: ${order.status})`);
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
    const order = await OrderModel.findById(orderId, SINGLE_STORE_ID);
    if (!order) throw new Error('Order not found');
    await OrderStateMachine.assertAllowed(order.status, 'delivery_attempted');

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
    const order = await OrderModel.findById(orderId, SINGLE_STORE_ID);
    if (!order) throw new Error('Order not found');

    await OrderStateMachine.assertAllowed(order.status, 'delivered');

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

    eventBus.emit('order.delivered', {
      actor: { id: adminId, fullName: await resolveUserName(adminId), role: 'admin' },
      resourceType: 'order',
      resourceId: orderId,
      actionType: 'STATUS_CHANGE',
      severity: 'info',
      title: 'Order delivered',
      message: `Order #${order.order_number} was marked as delivered.`,
      data: { orderId, orderNumber: order.order_number },
      deepLink: `/orders/${orderId}`,
    });

    return updatedOrder;
  }

  /**
   * Driver returned the undelivered package to the store.
   * Re-queues the order as 'processing' so admin knows it needs a new delivery attempt.
   */
  async markReturnedToStore(orderId, note, adminId) {
    const order = await OrderModel.findById(orderId, SINGLE_STORE_ID);
    if (!order) throw new Error('Order not found');

    // Previously had no transition guard at all — could re-queue an order as
    // 'processing' from any status.
    await OrderStateMachine.assertAllowed(order.status, 'processing');

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

  /**
   * Mark a delivered order as completed (terminal state).
   * Closes the return window and prevents further status transitions.
   */
  async completeOrder(orderId, adminId) {
    const order = await OrderModel.findById(orderId, SINGLE_STORE_ID);
    if (!order) throw new Error('Order not found');

    if (!await OrderStateMachine.isAllowed(order.status, 'completed')) {
      throw new Error(`Cannot complete order unless it has been delivered (current status: ${order.status})`);
    }

    const now = new Date().toISOString();

    const updatedOrder = await OrderModel.update(orderId, {
      status:     'completed',
      updated_at: now
    });

    await logHistory(orderId, 'completed', 'Order marked as completed', adminId);

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
    const order = await OrderModel.findById(orderId, SINGLE_STORE_ID);
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

    eventBus.emit('order.returned', {
      actor: { id: userId, fullName: userName, role: 'customer' },
      resourceType: 'order',
      resourceId: orderId,
      actionType: 'STATUS_CHANGE',
      severity: 'warning',
      title: 'Return requested',
      message: `Return requested for order #${order.order_number} by customer.`,
      data: { orderId, orderNumber: order.order_number, reason: reason || 'Customer request' },
      deepLink: `/orders/${orderId}`,
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
    const order = await OrderModel.findById(orderId, SINGLE_STORE_ID);
    if (!order) throw new Error('Order not found');

    const { roles } = await UserModel.getUserRolesAndPermissions(adminId);
    const isOrderStaffOnly = roles.includes('ORDER_STAFF') && !roles.some(r => ['STORE_OWNER', 'MANAGER'].includes(r));
    if (isOrderStaffOnly) {
      const error = new Error('Order Staff are not authorized to process returns');
      error.statusCode = 403;
      throw error;
    }

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

    if (action === 'process_refund') {
      const amountToRefund = refundAmount != null ? refundAmount : (order.refund_amount || order.total_amount);
      if (amountToRefund > 0) {
        await PaymentService.refundPayment(orderId, amountToRefund, note || 'Refund for return');
      }
      updateData.refund_status = 'pending';
    }

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
            adminId,
            `Order ${order.order_number} return QC passed — sellable stock reintegrated`,
            item.variant_id
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

  async claimGuestOrders(userId, email, reqContext) {
    if (!email) throw new Error('Email is required to claim guest orders');

    // 1. Fetch user to verify they exist and are verified
    const user = await UserModel.findById(userId);
    if (!user) throw new Error('User not found');
    if (!user.is_verified) {
      throw new Error('Please verify your email address before claiming guest orders');
    }

    // 2. Perform database update
    const claimedOrders = await OrderModel.claimGuestOrders(userId, email, SINGLE_STORE_ID);

    // 2b. Backfill user_coupons for any coupon usage from the claimed guest
    // orders. Guest checkouts are only tracked in the per-customer abuse
    // check by email against `orders`, never in `user_coupons` — without
    // this backfill, the same coupon usage becomes invisible to the
    // registered-user check (user_coupons) once the account is claimed,
    // allowing the same coupon to be effectively redeemed twice across the
    // guest -> registered transition.
    const paidCouponOrders = claimedOrders.filter(o => o.coupon_id && o.payment_status === 'paid');
    for (const paidOrder of paidCouponOrders) {
      try {
        await CouponModel.logUserUsage(userId, paidOrder.coupon_id, paidOrder.id);
      } catch (backfillErr) {
        logger.warn(`[OrderService] Failed to backfill coupon usage for claimed order ${paidOrder.id}: ${backfillErr.message}`);
      }
    }

    // 3. Log audit event
    if (claimedOrders.length > 0) {
      await AuditService.log(reqContext, 'orders.guest_claimed', 'user', userId, null, {
        email,
        claimedCount: claimedOrders.length,
        orderNumbers: claimedOrders.map(o => o.order_number)
      });
    }

    return claimedOrders;
  }

  async bulkOrderAction(orderIds, action, extraData = {}, adminId, reqContext) {
    const validActions = ['pack', 'dispatch', 'deliver', 'cancel'];
    if (!validActions.includes(action)) {
      throw new Error(`Invalid action: ${action}. Valid choices: ${validActions.join(', ')}`);
    }

    const successes = [];
    const failures = [];

    for (const orderId of orderIds) {
      try {
        let result;
        if (action === 'pack') {
          result = await this.markReadyForDispatch(orderId, extraData.note, adminId);
        } else if (action === 'dispatch') {
          result = await this.dispatchOrder(orderId, extraData, adminId);
        } else if (action === 'deliver') {
          result = await this.markDelivered(orderId, extraData, adminId);
        } else if (action === 'cancel') {
          result = await this.cancelOrder(orderId, adminId, extraData.reason, true);
        }
        successes.push(orderId);
      } catch (err) {
        failures.push({
          orderId,
          error: err.message
        });
      }
    }

    // Log bulk action event
    if (successes.length > 0) {
      await AuditService.log(reqContext, 'order.bulk_action', 'order', null, null, {
        action,
        successCount: successes.length,
        failureCount: failures.length,
        successes
      });
    }

    return {
      successCount: successes.length,
      failureCount: failures.length,
      successes,
      failures
    };
  }

  async exportOrders(filters, format = 'csv') {
    const reportExporter = require('../utils/report-exporter');
    const PDFDocument = require('pdfkit');

    const effectiveFilters = { ...filters };
    effectiveFilters.store_id = SINGLE_STORE_ID;
    const orders = await OrderModel.findAllWithoutPagination(effectiveFilters);
    
    if (format === 'pdf') {
      return new Promise((resolve, reject) => {
        try {
          const doc = new PDFDocument({ margin: 40 });
          const buffers = [];
          doc.on('data', buffers.push.bind(buffers));
          doc.on('end', () => {
            resolve(Buffer.concat(buffers));
          });

          doc.fillColor('#DC2626').fontSize(20).text('NOVA STORE', 40, 40, { continued: true });
          doc.fillColor('#333333').fontSize(16).text(' - ORDERS EXPORT REPORT', { align: 'left' });
          doc.moveDown(0.5);

          doc.fontSize(9).fillColor('#666666');
          doc.text(`Generated At: ${new Date().toLocaleString()}`);
          doc.text(`Status Filter: ${filters.status || 'All'}`);
          doc.text(`Date Range: ${filters.dateFrom || 'N/A'} to ${filters.dateTo || 'N/A'}`);
          doc.moveDown();

          let totalCount = orders.length;
          let totalRevenue = 0;
          let totalTax = 0;
          let totalShipping = 0;

          orders.forEach(o => {
            totalRevenue += Number(o.total_amount || 0);
            totalTax += Number(o.tax_amount || 0);
            totalShipping += Number(o.shipping_cost || 0);
          });

          const summaryY = doc.y;
          doc.fontSize(10).fillColor('#111111').text('Export Summary:', 40, summaryY, { bold: true });
          doc.fontSize(9).fillColor('#333333');
          doc.text(`Total Orders: ${totalCount}`);
          doc.text(`Total Revenue: ₦${totalRevenue.toFixed(2)}`);
          doc.text(`Total Tax: ₦${totalTax.toFixed(2)}`);
          doc.text(`Total Shipping: ₦${totalShipping.toFixed(2)}`);
          doc.moveDown(1.5);

          const tableHeaderY = doc.y;
          doc.fontSize(9).fillColor('#111111');
          doc.text('Order No', 40, tableHeaderY, { width: 90 });
          doc.text('Date', 130, tableHeaderY, { width: 90 });
          doc.text('Customer Name/Email', 220, tableHeaderY, { width: 150 });
          doc.text('Status', 370, tableHeaderY, { width: 60, align: 'center' });
          doc.text('Total', 430, tableHeaderY, { width: 60, align: 'right' });
          doc.text('Payment', 490, tableHeaderY, { width: 60, align: 'center' });
          doc.moveDown(0.5);

          doc.moveTo(40, doc.y).lineTo(550, doc.y).strokeColor('#cccccc').stroke();
          doc.moveDown(0.5);

          doc.fillColor('#444444').fontSize(8);
          for (const order of orders) {
            if (doc.y > 700) {
              doc.addPage();
              const newPageHeaderY = doc.y;
              doc.fontSize(9).fillColor('#111111');
              doc.text('Order No', 40, newPageHeaderY, { width: 90 });
              doc.text('Date', 130, newPageHeaderY, { width: 90 });
              doc.text('Customer Name/Email', 220, newPageHeaderY, { width: 150 });
              doc.text('Status', 370, newPageHeaderY, { width: 60, align: 'center' });
              doc.text('Total', 430, newPageHeaderY, { width: 60, align: 'right' });
              doc.text('Payment', 490, newPageHeaderY, { width: 60, align: 'center' });
              doc.moveDown(0.5);
              doc.moveTo(40, doc.y).lineTo(550, doc.y).strokeColor('#cccccc').stroke();
              doc.moveDown(0.5);
              doc.fillColor('#444444').fontSize(8);
            }

            const rowY = doc.y;
            const customerName = order.user ? `${order.user.first_name || ''} ${order.user.last_name || ''}`.trim() : '';
            const customerText = customerName ? `${customerName} (${order.customer_email || order.user.email})` : (order.customer_email || 'N/A');
            const dateText = new Date(order.created_at).toLocaleDateString();

            doc.text(order.order_number, 40, rowY, { width: 90 });
            doc.text(dateText, 130, rowY, { width: 90 });
            doc.text(customerText, 220, rowY, { width: 150, lineBreak: false });
            doc.text(order.status, 370, rowY, { width: 60, align: 'center' });
            doc.text(`₦${Number(order.total_amount).toFixed(2)}`, 430, rowY, { width: 60, align: 'right' });
            doc.text(order.payment_status, 490, rowY, { width: 60, align: 'center' });
            doc.moveDown(0.5);
          }

          doc.end();
        } catch (err) {
          reject(err);
        }
      });
    }

    const flatList = orders.map(order => {
      const customerName = order.user ? `${order.user.first_name || ''} ${order.user.last_name || ''}`.trim() : '';
      return {
        'Order Number': order.order_number,
        'Status': order.status,
        'Customer Email': order.customer_email || (order.user ? order.user.email : ''),
        'Customer Name': customerName,
        'Subtotal': order.subtotal,
        'Shipping Cost': order.shipping_cost,
        'Tax Amount': order.tax_amount,
        'Total Amount': order.total_amount,
        'Payment Status': order.payment_status,
        'Created At': order.created_at,
      };
    });

    return reportExporter.toCSV(flatList);
  }

  async bulkAssignRider(orderIds, riderId, adminId, reqContext) {
    const RiderModel = require('../models/rider.model');
    const rider = await RiderModel.findById(riderId);
    if (!rider) {
      throw new Error('Rider not found');
    }
    if (!rider.is_active) {
      throw new Error('Cannot assign an inactive rider');
    }

    const successes = [];
    const failures = [];

    for (const orderId of orderIds) {
      try {
        const order = await OrderModel.findById(orderId, SINGLE_STORE_ID);
        if (!order) {
          failures.push({ orderId, error: 'Order not found' });
          continue;
        }

        if (order.status !== 'ready_for_dispatch') {
          failures.push({ orderId, error: `Order is not ready for dispatch (current: ${order.status})` });
          continue;
        }

        await this.dispatchOrder(orderId, {
          riderId: rider.id,
          riderName: `${rider.first_name} ${rider.last_name}`,
          riderPhone: rider.phone,
          driverName: `${rider.first_name} ${rider.last_name}`,
          driverPhone: rider.phone
        }, adminId);

        successes.push(orderId);
      } catch (err) {
        failures.push({ orderId, error: err.message });
      }
    }

    if (successes.length > 0) {
      await AuditService.log(reqContext, 'order.bulk_assign_rider', 'order', null, null, {
        riderId,
        riderName: `${rider.first_name} ${rider.last_name}`,
        successCount: successes.length,
        failureCount: failures.length,
        successes
      });
    }

    return {
      successCount: successes.length,
      failureCount: failures.length,
      successes,
      failures
    };
  }


}

module.exports = new OrderService();
