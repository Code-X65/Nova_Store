const orderService = require('../../../src/services/order.service');
const OrderModel = require('../../../src/models/order.model');
const OrderStatusHistoryModel = require('../../../src/models/order-status-history.model');
const DeliveryDispatchModel = require('../../../src/models/delivery-dispatch.model');
const UserModel = require('../../../src/models/user.model');
const CartService = require('../../../src/services/cart.service');
const InventoryService = require('../../../src/services/inventory.service');
const NotificationService = require('../../../src/services/notification.service');
const NotificationTemplateModel = require('../../../src/models/notification-template.model');
const logger = require('../../../src/utils/logger');
const AuditService = require('../../../src/services/audit.service');

jest.mock('../../../src/models/order.model');
jest.mock('../../../src/models/order-status-history.model');
jest.mock('../../../src/models/delivery-dispatch.model');
jest.mock('../../../src/models/user.model');
jest.mock('../../../src/services/cart.service');
jest.mock('../../../src/services/inventory.service');
jest.mock('../../../src/services/notification.service');
jest.mock('../../../src/models/notification-template.model');
jest.mock('../../../src/utils/logger');
jest.mock('../../../src/services/audit.service');
const PaymentService = require('../../../src/services/payment.service');
jest.mock('../../../src/services/payment.service');

describe('OrderService', () => {
  const mockUserId = 'user-uuid-123';
  const mockAdminId = 'admin-uuid-456';
  const mockOrder = {
    id: 'order-uuid-999',
    user_id: mockUserId,
    order_number: 'NS-10001',
    status: 'pending',
    return_status: null,
    total_amount: 5500,
    items: [
      { product_id: 'prod-1', quantity: 2, unit_price: 2000 },
      { product_id: 'prod-2', quantity: 1, unit_price: 1500 }
    ]
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Default mock for user lookup to satisfy resolveUserName
    UserModel.findById.mockResolvedValue({
      id: mockUserId,
      first_name: 'John',
      last_name: 'Doe'
    });
    AuditService.log.mockResolvedValue(undefined);
  });

  describe('getUserOrders', () => {
    it('should query user orders using the OrderModel', async () => {
      const mockResult = { orders: [mockOrder], pagination: { total: 1 } };
      OrderModel.findByUserId.mockResolvedValue(mockResult);

      const result = await orderService.getUserOrders(mockUserId, { status: 'pending' }, { page: 1, limit: 10 });
      expect(result).toEqual(mockResult);
      expect(OrderModel.findByUserId).toHaveBeenCalledWith(mockUserId, { status: 'pending' }, { page: 1, limit: 10 });
    });
  });

  describe('getOrderDetails', () => {
    it('should load order details with history for owner user', async () => {
      const mockHistory = [{ id: 'hist-1', status: 'pending' }];
      const mockDispatches = [];
      OrderModel.findById.mockResolvedValue(mockOrder);
      OrderStatusHistoryModel.findByOrderId.mockResolvedValue(mockHistory);
      DeliveryDispatchModel.findByOrderId.mockResolvedValue(mockDispatches);

      const result = await orderService.getOrderDetails(mockOrder.id, mockUserId, false);
      expect(result).toEqual({ ...mockOrder, history: mockHistory, dispatches: mockDispatches });
      expect(OrderModel.findById).toHaveBeenCalledWith(mockOrder.id);
      expect(OrderStatusHistoryModel.findByOrderId).toHaveBeenCalledWith(mockOrder.id);
    });

    it('should throw an error if order is not found', async () => {
      OrderModel.findById.mockResolvedValue(null);

      await expect(orderService.getOrderDetails('invalid-id', mockUserId, false)).rejects.toThrow('Order not found');
    });

    it('should throw an error if user is not authorized owner and not admin', async () => {
      OrderModel.findById.mockResolvedValue(mockOrder);

      await expect(orderService.getOrderDetails(mockOrder.id, 'unauthorized-user-id', false)).rejects.toThrow('Unauthorized access to order');
    });

    it('should allow admin to load details of any user order', async () => {
      const mockHistory = [];
      const mockDispatches = [];
      OrderModel.findById.mockResolvedValue(mockOrder);
      OrderStatusHistoryModel.findByOrderId.mockResolvedValue(mockHistory);
      DeliveryDispatchModel.findByOrderId.mockResolvedValue(mockDispatches);

      const result = await orderService.getOrderDetails(mockOrder.id, 'some-other-id', true);
      expect(result).toEqual({ ...mockOrder, history: mockHistory, dispatches: mockDispatches });
    });
  });

  describe('cancelOrder', () => {
    it('should successfully cancel a pending order, restock inventory, and send notifications', async () => {
      OrderModel.findById.mockResolvedValue(mockOrder);
      OrderModel.updateStatus.mockResolvedValue({ ...mockOrder, status: 'cancelled' });
      NotificationTemplateModel.findByKey.mockResolvedValue({ id: 'tmpl-1' });

      const result = await orderService.cancelOrder(mockOrder.id, mockUserId, 'Changed mind');
      expect(result.status).toBe('cancelled');
      expect(OrderModel.updateStatus).toHaveBeenCalledWith(mockOrder.id, 'cancelled', null, expect.stringContaining('Changed mind'), mockUserId);

      // Verify inventory restocked
      expect(InventoryService.addStock).toHaveBeenCalledTimes(2);
      expect(InventoryService.addStock).toHaveBeenNthCalledWith(1, 'prod-1', 2, mockUserId, 'Order NS-10001 cancelled', undefined);
      expect(InventoryService.addStock).toHaveBeenNthCalledWith(2, 'prod-2', 1, mockUserId, 'Order NS-10001 cancelled', undefined);

      // Verify notification sent
      expect(NotificationService.sendToUser).toHaveBeenCalledWith(mockUserId, 'order_cancelled', {
        userName: 'John Doe',
        orderNumber: mockOrder.order_number,
        reason: 'Changed mind'
      }, null, null, { async: true });
    });

    it('should throw an error if order is in a non-cancellable state', async () => {
      const shippedOrder = { ...mockOrder, status: 'shipped' };
      OrderModel.findById.mockResolvedValue(shippedOrder);

      await expect(orderService.cancelOrder(shippedOrder.id, mockUserId, 'Reason')).rejects.toThrow('Order cannot be cancelled in current status: shipped');
    });
  });

  describe('reorder', () => {
    it('should load order items back into user cart', async () => {
      const mockCart = { id: 'cart-1', items: [] };
      OrderModel.findById.mockResolvedValue(mockOrder);
      CartService.addItem.mockResolvedValue({ success: true });
      CartService.getOrCreateCart.mockResolvedValue(mockCart);

      const result = await orderService.reorder(mockOrder.id, mockUserId);
      expect(result).toEqual(mockCart);
      expect(CartService.addItem).toHaveBeenCalledTimes(2);
      expect(CartService.addItem).toHaveBeenNthCalledWith(1, mockUserId, null, 'prod-1', undefined, 2);
      expect(CartService.addItem).toHaveBeenNthCalledWith(2, mockUserId, null, 'prod-2', undefined, 1);
    });
  });

  describe('updateOrderStatus', () => {
    it('should update status and tracking details, and send shipping notification', async () => {
      const localMockOrder = { ...mockOrder, status: 'processing' };
      OrderModel.findById.mockResolvedValue(localMockOrder);
      OrderModel.updateStatus.mockResolvedValue({ ...localMockOrder, status: 'shipped' });
      NotificationTemplateModel.findByKey.mockResolvedValue({ id: 'tmpl-shipped' });

      const result = await orderService.updateOrderStatus(localMockOrder.id, {
        status: 'shipped',
        trackingNumber: 'TRK123',
        carrier: 'DHL',
        note: 'Sent out'
      }, mockAdminId);

      expect(result.status).toBe('shipped');
      expect(OrderModel.updateStatus).toHaveBeenCalledWith(localMockOrder.id, 'shipped', null, 'Sent out', mockAdminId);
      expect(OrderModel.update).toHaveBeenCalledWith(localMockOrder.id, { tracking_number: 'TRK123', carrier: 'DHL' });
      expect(OrderStatusHistoryModel.create).toHaveBeenCalledWith({
        order_id: localMockOrder.id,
        status: 'shipped',
        note: 'Sent out',
        changed_by: mockAdminId
      });
      expect(NotificationService.sendToUser).toHaveBeenCalledWith(mockUserId, 'order_shipped', {
        userName: 'John Doe',
        orderNumber: localMockOrder.order_number,
        trackingNumber: 'TRK123',
        carrier: 'DHL'
      }, null, null, { async: true });
    });
  });

  describe('requestReturn', () => {
    it('should submit a return request for a delivered order', async () => {
      const deliveredAt = new Date().toISOString();
      const deliveredOrder = { ...mockOrder, status: 'delivered', delivered_at: deliveredAt };
      OrderModel.findById.mockResolvedValue(deliveredOrder);
      OrderModel.update.mockResolvedValue({ ...deliveredOrder, status: 'returned', return_status: 'requested' });
      NotificationTemplateModel.findByKey.mockResolvedValue({ id: 'tmpl-ret' });

      const result = await orderService.requestReturn(deliveredOrder.id, mockUserId, 'Defective product');
      expect(result.status).toBe('returned');
      expect(result.return_status).toBe('requested');
      expect(OrderModel.update).toHaveBeenCalledWith(deliveredOrder.id, {
        return_status: 'requested',
        return_reason: 'Defective product',
        return_evidence_urls: null,
        return_evidence_notes: null,
        status: 'returned'
      });
      expect(OrderStatusHistoryModel.create).toHaveBeenCalledWith({
        order_id: deliveredOrder.id,
        status: 'returned',
        note: 'Return requested by customer: Defective product',
        changed_by: mockUserId
      });
      expect(NotificationService.sendToUser).toHaveBeenCalledWith(mockUserId, 'return_requested', {
        userName: 'John Doe',
        orderNumber: deliveredOrder.order_number,
        reason: 'Defective product'
      }, null, null, { async: true });
    });

    it('should fail return request if return_status is already set', async () => {
      const alreadyReturnedOrder = { ...mockOrder, status: 'delivered', return_status: 'requested' };
      OrderModel.findById.mockResolvedValue(alreadyReturnedOrder);

      await expect(orderService.requestReturn(alreadyReturnedOrder.id, mockUserId, 'Reason')).rejects.toThrow('A return has already been requested for this order');
    });

    it('should reject a return request after the 7-day return window', async () => {
      const oldDeliveredAt = new Date();
      oldDeliveredAt.setDate(oldDeliveredAt.getDate() - 8);
      const expiredWindowOrder = {
        ...mockOrder,
        status: 'delivered',
        delivered_at: oldDeliveredAt.toISOString(),
        return_window_expires_at: new Date(oldDeliveredAt.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
      };
      OrderModel.findById.mockResolvedValue(expiredWindowOrder);

      await expect(
        orderService.requestReturn(expiredWindowOrder.id, mockUserId, 'Late reason')
      ).rejects.toThrow('Return window has expired');
    });
  });

  describe('processReturn', () => {
    it('should approve a return and create history log', async () => {
      const returnedOrder = { ...mockOrder, status: 'returned', return_status: 'requested' };
      OrderModel.findById.mockResolvedValue(returnedOrder);
      OrderModel.update.mockResolvedValue({ ...returnedOrder, return_status: 'approved' });
      NotificationTemplateModel.findByKey.mockResolvedValue({ id: 'tmpl-approved' });

      const result = await orderService.processReturn(returnedOrder.id, { action: 'approve', note: 'Looks good' }, mockAdminId);
      expect(result.return_status).toBe('approved');
      expect(OrderModel.update).toHaveBeenCalledWith(returnedOrder.id, { return_status: 'approved' });
      expect(OrderStatusHistoryModel.create).toHaveBeenCalledWith({
        order_id: returnedOrder.id,
        status: 'approved',
        note: 'Looks good',
        changed_by: mockAdminId
      });
      expect(NotificationService.sendToUser).toHaveBeenCalledWith(mockUserId, 'return_approved', {
        userName: 'John Doe',
        orderNumber: returnedOrder.order_number,
        refundAmount: undefined,
        action: 'approve'
      }, null, null, { async: true });
    });

    it('should complete a return refund and mark refund_status as completed', async () => {
      const returnedOrder = { ...mockOrder, status: 'returned', return_status: 'refund_pending' };
      OrderModel.findById.mockResolvedValue(returnedOrder);
      OrderModel.update.mockResolvedValue({ ...returnedOrder, return_status: 'refund_completed', refund_status: 'completed', status: 'refunded' });
      NotificationTemplateModel.findByKey.mockResolvedValue({ id: 'tmpl-comp' });

      const result = await orderService.processReturn(returnedOrder.id, { action: 'complete', note: 'Processed refund', refundAmount: 5000 }, mockAdminId);
      expect(result.return_status).toBe('refund_completed');
      expect(OrderModel.update).toHaveBeenCalledWith(returnedOrder.id, {
        return_status: 'refund_completed',
        refund_amount: 5000,
        refund_status: 'completed',
        refunded_at: expect.any(String),
        status: 'refunded'
      });
      expect(OrderStatusHistoryModel.create).toHaveBeenCalledWith({
        order_id: returnedOrder.id,
        status: 'refund_completed',
        note: 'Processed refund',
        changed_by: mockAdminId
      });
      expect(NotificationService.sendToUser).toHaveBeenCalledWith(mockUserId, 'return_refund_completed', {
        userName: 'John Doe',
        orderNumber: returnedOrder.order_number,
        refundAmount: '₦5000',
        action: 'complete'
      }, null, null, { async: true });
    });

    it('should initiate a return refund gateway call and set refund_status as pending', async () => {
      const returnedOrder = { ...mockOrder, status: 'returned', return_status: 'qc_received' };
      OrderModel.findById.mockResolvedValue(returnedOrder);
      OrderModel.update.mockResolvedValue({ ...returnedOrder, return_status: 'refund_pending', refund_status: 'pending' });
      NotificationTemplateModel.findByKey.mockResolvedValue({ id: 'tmpl-pending' });
      PaymentService.refundPayment.mockResolvedValue({ success: true });

      const result = await orderService.processReturn(returnedOrder.id, { action: 'process_refund', note: 'Initiating refund', refundAmount: 5000 }, mockAdminId);
      expect(result.return_status).toBe('refund_pending');
      expect(PaymentService.refundPayment).toHaveBeenCalledWith(returnedOrder.id, 5000, 'Initiating refund');
      expect(OrderModel.update).toHaveBeenCalledWith(returnedOrder.id, {
        return_status: 'refund_pending',
        refund_amount: 5000,
        refund_status: 'pending'
      });
      expect(OrderStatusHistoryModel.create).toHaveBeenCalledWith({
        order_id: returnedOrder.id,
        status: 'refund_pending',
        note: 'Initiating refund',
        changed_by: mockAdminId
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Fix 8 — Unit tests for 7 delivery milestone methods
  // ─────────────────────────────────────────────────────────────────────────────
  describe('Manual Delivery Milestones', () => {
    describe('markReadyForDispatch', () => {
      it('should transition status to ready_for_dispatch and delivery_status to not_dispatched', async () => {
        const localOrder = { ...mockOrder, status: 'processing' };
        OrderModel.findById.mockResolvedValue(localOrder);
        OrderModel.update.mockResolvedValue({ ...localOrder, status: 'ready_for_dispatch', delivery_status: 'not_dispatched' });
        NotificationTemplateModel.findByKey.mockResolvedValue({ id: 'tmpl' });

        const result = await orderService.markReadyForDispatch(localOrder.id, 'Packed', mockAdminId);
        expect(result.status).toBe('ready_for_dispatch');
        expect(OrderModel.update).toHaveBeenCalledWith(localOrder.id, {
          status: 'ready_for_dispatch',
          delivery_status: 'not_dispatched',
          updated_at: expect.any(String)
        });
        expect(OrderStatusHistoryModel.create).toHaveBeenCalledWith({
          order_id: localOrder.id,
          status: 'ready_for_dispatch',
          note: 'Packed',
          changed_by: mockAdminId
        });
        expect(NotificationService.sendToUser).toHaveBeenCalledWith(mockUserId, 'order_processing', {
          userName: 'John Doe',
          orderNumber: localOrder.order_number
        }, null, null, { async: true });
      });

      it('should fail if order is in a status not allowed for dispatch prep', async () => {
        const localOrder = { ...mockOrder, status: 'shipped' };
        OrderModel.findById.mockResolvedValue(localOrder);

        await expect(
          orderService.markReadyForDispatch(localOrder.id, 'Packed', mockAdminId)
        ).rejects.toThrow('Cannot mark as ready_for_dispatch from status: shipped');
      });
    });

    describe('dispatchOrder', () => {
      it('should create delivery_dispatches record and update order fields', async () => {
        const localOrder = { ...mockOrder, status: 'ready_for_dispatch' };
        OrderModel.findById.mockResolvedValue(localOrder);
        OrderModel.update.mockResolvedValue({
          ...localOrder,
          status: 'dispatched',
          delivery_status: 'assigned',
          driver_name: 'Driver Dave'
        });
        NotificationTemplateModel.findByKey.mockResolvedValue({ id: 'tmpl' });

        const result = await orderService.dispatchOrder(
          localOrder.id,
          {
            driverName: 'Driver Dave',
            driverPhone: '08012345678',
            dispatchNotes: 'Fragile',
            deliveryWindow: '10am-2pm'
          },
          mockAdminId
        );

        expect(result.status).toBe('dispatched');
        expect(DeliveryDispatchModel.create).toHaveBeenCalledWith({
          order_id: localOrder.id,
          assigned_by: mockAdminId,
          driver_name: 'Driver Dave',
          driver_phone: '08012345678',
          dispatch_notes: 'Fragile'
        });
        expect(OrderModel.update).toHaveBeenCalledWith(localOrder.id, {
          status: 'dispatched',
          delivery_status: 'assigned',
          driver_name: 'Driver Dave',
          driver_phone: '08012345678',
          dispatched_at: expect.any(String),
          manual_dispatch_notes: 'Fragile',
          delivery_window: '10am-2pm',
          updated_at: expect.any(String)
        });
        expect(OrderStatusHistoryModel.create).toHaveBeenCalledWith({
          order_id: localOrder.id,
          status: 'dispatched',
          note: 'Assigned to driver: Driver Dave',
          changed_by: mockAdminId
        });
        expect(NotificationService.sendToUser).toHaveBeenCalledWith(mockUserId, 'order_dispatched', {
          userName: 'John Doe',
          orderNumber: localOrder.order_number
        }, null, null, { async: true });
      });

      it('should throw if driverName is missing', async () => {
        const localOrder = { ...mockOrder, status: 'ready_for_dispatch' };
        OrderModel.findById.mockResolvedValue(localOrder);

        await expect(
          orderService.dispatchOrder(localOrder.id, { driverPhone: '123' }, mockAdminId)
        ).rejects.toThrow('Driver name is required to dispatch');
      });

      it('should throw if order status is invalid for dispatch', async () => {
        const localOrder = { ...mockOrder, status: 'cancelled' };
        OrderModel.findById.mockResolvedValue(localOrder);

        await expect(
          orderService.dispatchOrder(localOrder.id, { driverName: 'Dave' }, mockAdminId)
        ).rejects.toThrow('Cannot dispatch order from status: cancelled');
      });
    });

    describe('markPickedUp', () => {
      it('should update dispatch record status and order delivery_status to picked_up', async () => {
        const localOrder = { ...mockOrder, status: 'dispatched', delivery_status: 'assigned' };
        OrderModel.findById.mockResolvedValue(localOrder);
        OrderModel.update.mockResolvedValue({ ...localOrder, delivery_status: 'picked_up' });

        const result = await orderService.markPickedUp(localOrder.id, 'Picked up package', mockAdminId);
        expect(result.delivery_status).toBe('picked_up');
        expect(DeliveryDispatchModel.updateStatusByOrderId).toHaveBeenCalledWith(localOrder.id, 'picked_up', {
          picked_up_at: expect.any(String)
        });
        expect(OrderModel.update).toHaveBeenCalledWith(localOrder.id, {
          delivery_status: 'picked_up',
          updated_at: expect.any(String)
        });
        expect(OrderStatusHistoryModel.create).toHaveBeenCalledWith({
          order_id: localOrder.id,
          status: 'picked_up',
          note: 'Picked up package',
          changed_by: mockAdminId
        });
      });

      it('should throw if order status is not dispatched', async () => {
        const localOrder = { ...mockOrder, status: 'ready_for_dispatch' };
        OrderModel.findById.mockResolvedValue(localOrder);

        await expect(
          orderService.markPickedUp(localOrder.id, 'Note', mockAdminId)
        ).rejects.toThrow('Cannot mark as picked_up from status: ready_for_dispatch');
      });
    });

    describe('markOutForDelivery', () => {
      it('should transition order status to out_for_delivery', async () => {
        const localOrder = { ...mockOrder, status: 'dispatched', delivery_status: 'picked_up' };
        OrderModel.findById.mockResolvedValue(localOrder);
        OrderModel.update.mockResolvedValue({ ...localOrder, status: 'out_for_delivery', delivery_status: 'out_for_delivery' });
        NotificationTemplateModel.findByKey.mockResolvedValue({ id: 'tmpl' });

        const result = await orderService.markOutForDelivery(localOrder.id, 'En route', mockAdminId);
        expect(result.status).toBe('out_for_delivery');
        expect(DeliveryDispatchModel.updateStatusByOrderId).toHaveBeenCalledWith(localOrder.id, 'out_for_delivery');
        expect(OrderModel.update).toHaveBeenCalledWith(localOrder.id, {
          status: 'out_for_delivery',
          delivery_status: 'out_for_delivery',
          out_for_delivery_at: expect.any(String),
          updated_at: expect.any(String)
        });
        expect(OrderStatusHistoryModel.create).toHaveBeenCalledWith({
          order_id: localOrder.id,
          status: 'out_for_delivery',
          note: 'En route',
          changed_by: mockAdminId
        });
        expect(NotificationService.sendToUser).toHaveBeenCalledWith(mockUserId, 'order_out_for_delivery', {
          userName: 'John Doe',
          orderNumber: localOrder.order_number
        }, null, null, { async: true });
      });

      it('should throw if order state is invalid for out_for_delivery', async () => {
        const localOrder = { ...mockOrder, status: 'pending', delivery_status: 'not_dispatched' };
        OrderModel.findById.mockResolvedValue(localOrder);

        await expect(
          orderService.markOutForDelivery(localOrder.id, 'En route', mockAdminId)
        ).rejects.toThrow('Cannot mark as out_for_delivery from status: pending');
      });

      it('should throw if delivery_status does not match status in markOutForDelivery', async () => {
        const localOrder = { ...mockOrder, status: 'dispatched', delivery_status: 'assigned' };
        OrderModel.findById.mockResolvedValue(localOrder);

        await expect(
          orderService.markOutForDelivery(localOrder.id, 'En route', mockAdminId)
        ).rejects.toThrow('Cannot mark as out_for_delivery from delivery status: assigned');
      });
    });

    describe('markDeliveryAttempted', () => {
      it('should set status to delivery_attempted and delivery_status to attempted', async () => {
        const localOrder = { ...mockOrder, status: 'out_for_delivery', delivery_status: 'out_for_delivery' };
        OrderModel.findById.mockResolvedValue(localOrder);
        OrderModel.update.mockResolvedValue({ ...localOrder, status: 'delivery_attempted', delivery_status: 'attempted' });
        NotificationTemplateModel.findByKey.mockResolvedValue({ id: 'tmpl' });

        const result = await orderService.markDeliveryAttempted(localOrder.id, 'Gate locked', mockAdminId);
        expect(result.status).toBe('delivery_attempted');
        expect(DeliveryDispatchModel.updateStatusByOrderId).toHaveBeenCalledWith(localOrder.id, 'attempted', {
          failed_at: expect.any(String)
        });
        expect(OrderModel.update).toHaveBeenCalledWith(localOrder.id, {
          status: 'delivery_attempted',
          delivery_status: 'attempted',
          attempted_at: expect.any(String),
          updated_at: expect.any(String)
        });
        expect(OrderStatusHistoryModel.create).toHaveBeenCalledWith({
          order_id: localOrder.id,
          status: 'delivery_attempted',
          note: 'Gate locked',
          changed_by: mockAdminId
        });
        expect(NotificationService.sendToUser).toHaveBeenCalledWith(mockUserId, 'order_delivery_attempted', {
          userName: 'John Doe',
          orderNumber: localOrder.order_number
        }, null, null, { async: true });
      });

      it('should throw if order is not out_for_delivery', async () => {
        const localOrder = { ...mockOrder, status: 'dispatched' };
        OrderModel.findById.mockResolvedValue(localOrder);

        await expect(
          orderService.markDeliveryAttempted(localOrder.id, 'Gate locked', mockAdminId)
        ).rejects.toThrow('Cannot mark delivery_attempted from status: dispatched');
      });
    });

    describe('markDelivered', () => {
      it('should set status to delivered, compute return window (+7d), and store POD details', async () => {
        const localOrder = { ...mockOrder, status: 'out_for_delivery', delivery_status: 'out_for_delivery' };
        OrderModel.findById.mockResolvedValue(localOrder);
        OrderModel.update.mockResolvedValue({
          ...localOrder,
          status: 'delivered',
          delivery_status: 'delivered',
          delivered_at: new Date().toISOString(),
          return_window_expires_at: new Date().toISOString()
        });
        NotificationTemplateModel.findByKey.mockResolvedValue({ id: 'tmpl' });

        const result = await orderService.markDelivered(
          localOrder.id,
          { podType: 'signature', podValue: 'pod_sig_123', note: 'Signed by sister' },
          mockAdminId
        );

        expect(result.status).toBe('delivered');
        expect(DeliveryDispatchModel.updateStatusByOrderId).toHaveBeenCalledWith(localOrder.id, 'delivered', {
          delivered_at: expect.any(String),
          pod_type: 'signature',
          pod_value: 'pod_sig_123'
        });
        expect(OrderModel.update).toHaveBeenCalledWith(localOrder.id, {
          status: 'delivered',
          delivery_status: 'delivered',
          delivered_at: expect.any(String),
          return_window_expires_at: expect.any(String),
          updated_at: expect.any(String)
        });
        expect(OrderStatusHistoryModel.create).toHaveBeenCalledWith({
          order_id: localOrder.id,
          status: 'delivered',
          note: 'Signed by sister',
          changed_by: mockAdminId
        });
        expect(NotificationService.sendToUser).toHaveBeenCalledWith(mockUserId, 'order_delivered', {
          userName: 'John Doe',
          orderNumber: localOrder.order_number
        }, null, null, { async: true });
      });
    });

    describe('markReturnedToStore', () => {
      it('should update delivery_status to returned_to_store and reset status to processing', async () => {
        const localOrder = { ...mockOrder, status: 'delivery_attempted', delivery_status: 'attempted' };
        OrderModel.findById.mockResolvedValue(localOrder);
        OrderModel.update.mockResolvedValue({ ...localOrder, status: 'processing', delivery_status: 'returned_to_store' });

        const result = await orderService.markReturnedToStore(localOrder.id, 'Returned pack', mockAdminId);
        expect(result.status).toBe('processing');
        expect(result.delivery_status).toBe('returned_to_store');
        expect(DeliveryDispatchModel.updateStatusByOrderId).toHaveBeenCalledWith(localOrder.id, 'returned_to_store');
        expect(OrderModel.update).toHaveBeenCalledWith(localOrder.id, {
          status: 'processing',
          delivery_status: 'returned_to_store',
          updated_at: expect.any(String)
        });
        expect(OrderStatusHistoryModel.create).toHaveBeenCalledWith({
          order_id: localOrder.id,
          status: 'returned_to_store',
          note: 'Returned pack',
          changed_by: mockAdminId
        });
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Fix 9 — Unit tests for return transition guardrails
  // ─────────────────────────────────────────────────────────────────────────────
  describe('Return Transition Guardrails', () => {
    it('should throw when trying to approve an order with no return requested', async () => {
      const localOrder = { ...mockOrder, return_status: null };
      OrderModel.findById.mockResolvedValue(localOrder);

      await expect(
        orderService.processReturn(localOrder.id, { action: 'approve', note: 'Ok' }, mockAdminId)
      ).rejects.toThrow(/Invalid return transition: cannot perform 'approve'/);
    });

    it('should throw when trying to schedule pickup before approval', async () => {
      const localOrder = { ...mockOrder, return_status: 'requested' };
      OrderModel.findById.mockResolvedValue(localOrder);

      await expect(
        orderService.processReturn(localOrder.id, { action: 'schedule_pickup', note: 'Ok' }, mockAdminId)
      ).rejects.toThrow(/Invalid return transition: cannot perform 'schedule_pickup'/);
    });

    it('should throw when trying to complete refund without QC receipt', async () => {
      const localOrder = { ...mockOrder, return_status: 'approved' };
      OrderModel.findById.mockResolvedValue(localOrder);

      await expect(
        orderService.processReturn(localOrder.id, { action: 'complete', note: 'Ok' }, mockAdminId)
      ).rejects.toThrow(/Invalid return transition: cannot perform 'complete'/);
    });

    it('should succeed to approve when return_status is requested', async () => {
      const localOrder = { ...mockOrder, status: 'returned', return_status: 'requested' };
      OrderModel.findById.mockResolvedValue(localOrder);
      OrderModel.update.mockResolvedValue({ ...localOrder, return_status: 'approved' });
      NotificationTemplateModel.findByKey.mockResolvedValue({ id: 'tmpl' });

      const result = await orderService.processReturn(localOrder.id, { action: 'approve', note: 'Ok' }, mockAdminId);
      expect(result.return_status).toBe('approved');
      expect(OrderModel.update).toHaveBeenCalledWith(localOrder.id, { return_status: 'approved' });
    });

    it('should succeed to complete refund when return_status is refund_pending', async () => {
      const localOrder = { ...mockOrder, status: 'returned', return_status: 'refund_pending' };
      OrderModel.findById.mockResolvedValue(localOrder);
      OrderModel.update.mockResolvedValue({ ...localOrder, return_status: 'refund_completed', refund_status: 'completed', status: 'refunded' });
      NotificationTemplateModel.findByKey.mockResolvedValue({ id: 'tmpl' });

      const result = await orderService.processReturn(localOrder.id, { action: 'complete', note: 'Ok', refundAmount: 5000 }, mockAdminId);
      expect(result.return_status).toBe('refund_completed');
      expect(OrderModel.update).toHaveBeenCalledWith(localOrder.id, {
        return_status: 'refund_completed',
        refund_amount: 5000,
        refund_status: 'completed',
        refunded_at: expect.any(String),
        status: 'refunded'
      });
    });
  });

  describe('claimGuestOrders', () => {
    const mockEmail = 'guest@example.com';
    const mockClaimedOrders = [
      { id: 'order-1', order_number: 'NS-10001', customer_email: mockEmail }
    ];

    it('should successfully claim guest orders if user email is verified', async () => {
      UserModel.findById.mockResolvedValue({
        id: mockUserId,
        first_name: 'John',
        last_name: 'Doe',
        is_verified: true
      });
      OrderModel.claimGuestOrders.mockResolvedValue(mockClaimedOrders);

      const result = await orderService.claimGuestOrders(mockUserId, mockEmail, {});
      expect(result).toEqual(mockClaimedOrders);
      expect(OrderModel.claimGuestOrders).toHaveBeenCalledWith(mockUserId, mockEmail);
      expect(AuditService.log).toHaveBeenCalledWith({}, 'orders.guest_claimed', 'user', mockUserId, null, {
        email: mockEmail,
        claimedCount: 1,
        orderNumbers: ['NS-10001']
      });
    });

    it('should throw an error if email is not provided', async () => {
      await expect(orderService.claimGuestOrders(mockUserId, null, {})).rejects.toThrow('Email is required to claim guest orders');
    });

    it('should throw an error if user does not exist', async () => {
      UserModel.findById.mockResolvedValue(null);
      await expect(orderService.claimGuestOrders('non-existent', mockEmail, {})).rejects.toThrow('User not found');
    });

    it('should throw an error if user email is not verified', async () => {
      UserModel.findById.mockResolvedValue({
        id: mockUserId,
        first_name: 'John',
        last_name: 'Doe',
        is_verified: false
      });
      await expect(orderService.claimGuestOrders(mockUserId, mockEmail, {})).rejects.toThrow('Please verify your email address before claiming guest orders');
    });
  });

  describe('bulkOrderAction', () => {
    const orderIds = ['order-1', 'order-2'];

    it('should throw an error for invalid action', async () => {
      await expect(orderService.bulkOrderAction(orderIds, 'invalid_action', {}, mockAdminId, {})).rejects.toThrow(/Invalid action: invalid_action/);
    });

    it('should process bulk pack actions and report successes/failures', async () => {
      // Mock pack success for order-1
      const order1 = { ...mockOrder, id: 'order-1', status: 'processing' };
      OrderModel.findById.mockResolvedValueOnce(order1);
      OrderModel.update.mockResolvedValueOnce({ ...order1, status: 'ready_for_dispatch', delivery_status: 'not_dispatched' });
      NotificationTemplateModel.findByKey.mockResolvedValue({ id: 'tmpl' });

      // Mock pack failure for order-2 by throwing error
      OrderModel.findById.mockRejectedValueOnce(new Error('Order not found'));

      const result = await orderService.bulkOrderAction(orderIds, 'pack', { note: 'Packed' }, mockAdminId, {});
      
      expect(result).toEqual({
        successCount: 1,
        failureCount: 1,
        successes: ['order-1'],
        failures: [
          { orderId: 'order-2', error: 'Order not found' }
        ]
      });

      expect(AuditService.log).toHaveBeenCalledWith({}, 'order.bulk_action', 'order', null, null, {
        action: 'pack',
        successCount: 1,
        failureCount: 1,
        successes: ['order-1']
      });
    });

    it('should process bulk cancel actions as admin', async () => {
      const order1 = { ...mockOrder, id: 'order-1', status: 'pending' };
      const order2 = { ...mockOrder, id: 'order-2', status: 'pending' };
      
      OrderModel.findById.mockResolvedValueOnce(order1).mockResolvedValueOnce(order2);
      OrderModel.updateStatus.mockResolvedValue({ ...order1, status: 'cancelled' });
      NotificationTemplateModel.findByKey.mockResolvedValue({ id: 'tmpl-cancel' });

      const result = await orderService.bulkOrderAction(orderIds, 'cancel', { reason: 'Stock issue' }, mockAdminId, {});

      expect(result).toEqual({
        successCount: 2,
        failureCount: 0,
        successes: ['order-1', 'order-2'],
        failures: []
      });

      expect(InventoryService.addStock).toHaveBeenCalledTimes(4); // 2 items * 2 orders
    });
  });
});
