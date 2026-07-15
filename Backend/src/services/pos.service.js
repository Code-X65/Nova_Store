const crypto = require('crypto');
const ProductModel = require('../models/product.model');
const OrderModel = require('../models/order.model');
const PaymentModel = require('../models/payment.model');
const UserModel = require('../models/user.model');
const InventoryReservationService = require('./inventory-reservation.service');
const ErrorResponse = require('../utils/errorResponse');
const eventBus = require('../realtime/event-bus');
const { SINGLE_STORE_ID } = require('../config/store');

class PosService {
  async createWalkInSale(adminId, { customerEmail, customerName, customerPhone, items, paymentMethod }) {
    if (!items || !items.length) throw new ErrorResponse('At least one item is required', 400);
    if (!paymentMethod) throw new ErrorResponse('Payment method is required', 400);

    // 1. Resolve items against live product data (never trust client-submitted prices)
    const orderItems = [];
    let subtotal = 0;
    const resolvedItems = [];

    for (const line of items) {
      const product = await ProductModel.findById(line.productId, SINGLE_STORE_ID);
      if (!product) throw new ErrorResponse(`Product ${line.productId} not found`, 404);

      let unitPrice = product.sale_price || product.price;
      if (line.variantId) {
        const variant = (product.variants || []).find((v) => v.id === line.variantId);
        if (!variant) throw new ErrorResponse(`Variant ${line.variantId} not found`, 404);
        if (variant.sale_price) unitPrice = variant.sale_price;
        else if (variant.price_modifier) unitPrice = Number(product.sale_price || product.price) + Number(variant.price_modifier);
      }

      const quantity = Number(line.quantity) || 0;
      if (quantity <= 0) throw new ErrorResponse('Quantity must be greater than zero', 400);

      const totalPrice = parseFloat((unitPrice * quantity).toFixed(2));
      subtotal += totalPrice;

      orderItems.push({
        product_id: product.id,
        variant_id: line.variantId || null,
        product_name: product.name,
        sku: product.sku,
        quantity,
        unit_price: unitPrice,
        total_price: totalPrice
      });
      resolvedItems.push({ productId: product.id, variantId: line.variantId || null, quantity });
    }

    subtotal = parseFloat(subtotal.toFixed(2));

    // 2. Resolve an existing customer by email if provided (never create a placeholder user)
    let userId = null;
    if (customerEmail) {
      const existingUser = await UserModel.findByEmail(customerEmail);
      if (existingUser) userId = existingUser.id;
    }

    // 3. Reserve stock for each line, then commit immediately (POS is an instant, in-person sale)
    const reservationErrors = [];
    for (const item of resolvedItems) {
      try {
        await InventoryReservationService.reserveStock(item.productId, item.quantity, item.variantId);
      } catch (err) {
        reservationErrors.push(err.message);
      }
    }
    if (reservationErrors.length > 0) {
      throw new ErrorResponse(`Stock unavailable: ${reservationErrors.join(', ')}`, 400);
    }

    // 4. Create the order
    const orderNumber = `POS-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const orderData = {
      user_id: userId,
      order_number: orderNumber,
      subtotal,
      shipping_cost: 0,
      tax_amount: 0,
      discount_amount: 0,
      total_amount: subtotal,
      coupon_id: null,
      shipping_address: null,
      shipping_method: null,
      customer_email: customerEmail || null,
      customer_phone: customerPhone || null,
      notes: 'Walk-in / offline sale',
      store_id: SINGLE_STORE_ID,
      payment_method: paymentMethod,
      channel: 'pos'
    };

    const order = await OrderModel.create(orderData, orderItems);

    // 5. Commit reserved stock → real stock reduction
    try {
      await InventoryReservationService.commitReservedStock(order.id);
    } catch (err) {
      console.error(`[POS] commitReservedStock warning for order ${order.id}:`, err.message);
    }

    // 6. Mark the order delivered/paid — a POS sale is an immediate in-person handover
    await OrderModel.updateStatus(order.id, 'delivered', 'paid');

    // 7. Record the payment
    await PaymentModel.create({
      order_id: order.id,
      user_id: userId,
      amount: subtotal,
      currency: 'NGN',
      provider: paymentMethod,
      reference: `POS-${orderNumber}-${crypto.randomBytes(4).toString('hex')}`,
      status: 'success',
      payment_method: paymentMethod
    });

    eventBus.emit('order.placed', {
      actor: { id: adminId, fullName: null, role: 'admin' },
      resourceType: 'order',
      resourceId: order.id,
      actionType: 'CREATE',
      severity: 'info',
      title: 'Walk-in sale recorded',
      message: `POS sale #${orderNumber} recorded — total ₦${subtotal.toFixed(2)}.`,
      data: { orderId: order.id, orderNumber, total: subtotal, channel: 'pos' },
      deepLink: `/orders/${order.id}`,
    });

    return order;
  }

  async getPosSales(filters = {}, pagination = { page: 1, limit: 20 }) {
    return await OrderModel.findAll({ ...filters, channel: 'pos', store_id: SINGLE_STORE_ID }, pagination);
  }

  async getPosSaleById(id) {
    const order = await OrderModel.findById(id, SINGLE_STORE_ID);
    if (!order || order.channel !== 'pos') throw new ErrorResponse('POS sale not found', 404);
    return order;
  }
}

module.exports = new PosService();
