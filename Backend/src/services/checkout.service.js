const CartService = require('./cart.service');
const CouponModel = require('../models/coupon.model');
const CouponService = require('./coupon.service');
const OrderModel = require('../models/order.model');
const ProductModel = require('../models/product.model');
const shippingService = require('./shipping.service');
const shippingRateModel = require('../models/shipping-rate.model');
const NotificationService = require('./notification.service');
const AuditService = require('./audit.service');
const eventBus = require('../realtime/event-bus');
const InventoryReservationService = require('./inventory-reservation.service');
const SettingService = require('./setting.service');
const crypto = require('crypto');
const supabase = require('../config/supabase');
const { SINGLE_STORE_ID } = require('../config/store');

class CheckoutService {
  async validateCheckout(userId, sessionId, cartId, address = null) {
    const cart = await CartService.getOrCreateCart(userId, sessionId);
    
    if (!cart.items || cart.items.length === 0) {
      throw new Error('Cart is empty');
    }

    const issues = [];
    const validatedItems = [];

    for (const item of cart.items) {
      const product = await ProductModel.findById(item.productId, SINGLE_STORE_ID);
      
      if (!product) {
        issues.push(`Product ${item.product?.name || 'Unknown'} is no longer available`);
        continue;
      }

      let availableQty = 0;
      let name = product.name;

      if (item.variantId) {
        const variant = (product.variants || []).find(v => v.id === item.variantId);
        if (!variant) {
          issues.push(`Variant for product ${product.name} is no longer available`);
          continue;
        }
        name = `${product.name} - ${variant.name}`;
        if (variant.track_inventory === false || product.track_inventory === false) {
          availableQty = Infinity;
        } else {
          availableQty = variant.stock_quantity || 0;
        }
      } else {
        if (product.track_inventory === false) {
          availableQty = Infinity;
        } else {
          availableQty = (product.stock_quantity || 0) - (product.reserved_quantity || 0);
        }
      }

      if (availableQty < item.quantity) {
        issues.push(`Insufficient available stock for ${name}. Available: ${availableQty}`);
      }

      let currentPrice = product.sale_price || product.price;
      if (item.variantId) {
        const variant = (product.variants || []).find(v => v.id === item.variantId);
        if (variant) {
          if (variant.sale_price) {
            currentPrice = variant.sale_price;
          } else if (variant.price_modifier) {
            currentPrice = Number(product.sale_price || product.price) + Number(variant.price_modifier);
          }
        }
      }

      if (currentPrice !== item.unitPrice) {
        issues.push(`Price for ${name} has changed`);
      }

      validatedItems.push({
        ...item,
        currentUnitPrice: currentPrice,
        inStock: availableQty >= item.quantity,
        availableQty
      });
    }

    let estimatedShipping = 0;
    if (address && address.country) {
      const options = await shippingService.calculateShippingOptions(address, cart.subtotal, 0);
      if (options.length > 0) estimatedShipping = options[0].price;
    }

    return {
      valid: issues.length === 0,
      issues,
      cart,
      subtotal: cart.subtotal,
      estimatedShipping,
      estimatedTax: await this.calculateTax(cart.subtotal, address)
    };
  }



  async createCheckoutSession(userId, sessionId, checkoutData) {
    const { cartId, shippingOption, address, couponCode, notes, paymentMethod } = checkoutData;
    
    // 1. Validate cart again
    const validation = await this.validateCheckout(userId, sessionId, cartId, address);
    if (!validation.valid) {
      throw new Error(`Checkout validation failed: ${validation.issues.join(', ')}`);
    }

    // 1b. Validate Pay on Delivery setting
    if (paymentMethod && ['pay_on_delivery', 'cod'].includes(paymentMethod)) {
      const storeModel = require('../models/store.model');
      const storeService = require('./store.service');
      const storeId = SINGLE_STORE_ID;
      const storeProfile = await storeService.getStoreProfile(storeId);
      const podEnabled = storeProfile?.settings?.['payment.pay_on_delivery_enabled'] === 'true';
      if (!podEnabled) {
        throw new Error('Pay on Delivery is not available at this time');
      }
    }

    // 2. Handle Coupon
    let discountAmount = 0;
    let couponId = null;
    if (couponCode) {
      const customerEmail = address?.email || checkoutData.email;
      const couponResult = await CouponService.validateAndApplyCoupon(userId, cartId, couponCode, validation.subtotal, customerEmail);
      discountAmount = couponResult.discount;
      couponId = couponResult.coupon.id;
    }

    // 3. Calculate Final Totals
    const shippingCost = await this.getShippingCost(shippingOption, validation.subtotal);
    const taxAmount = this.calculateTax(validation.subtotal, address);
    const totalAmount = validation.subtotal + shippingCost + taxAmount - discountAmount;

    // 4. Prepare Order Data
    const orderNumber = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const checkoutSessionId = crypto.randomUUID();

    const orderData = {
      user_id: userId,
      order_number: orderNumber,
      subtotal: validation.subtotal,
      shipping_cost: shippingCost,
      tax_amount: taxAmount,
      discount_amount: discountAmount,
      total_amount: totalAmount,
      coupon_id: couponId,
      shipping_address: address,
      shipping_method: shippingOption,
      customer_email: address.email || (userId ? null : checkoutData.email),
      customer_phone: address.phone,
      notes: notes,
      checkout_session_id: checkoutSessionId,
      store_id: SINGLE_STORE_ID,
      payment_method: paymentMethod || null
    };

    const orderItems = validation.cart.items.map(item => ({
      product_id: item.productId,
      variant_id: item.variantId,
      product_name: item.product.name,
      sku: item.product.sku,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      total_price: item.total
    }));

    // 5. Create Order
    const createdOrder = await OrderModel.create(orderData, orderItems);

    // 6. Reserve stock for the order (concurrency-safe gate for pending payment)
    const reservationErrors = [];
    for (const item of validation.cart.items) {
      try {
        await InventoryReservationService.reserveStock(item.productId, item.quantity, item.variantId || null);
      } catch (err) {
        reservationErrors.push(`${item.product.name}: ${err.message}`);
      }
    }
    if (reservationErrors.length > 0) {
      throw new Error(`Stock reservation failed: ${reservationErrors.join(', ')}`);
    }

    // 7. Trigger notifications
    if (userId) {
      // Background async call
      NotificationService.sendOrderConfirmation(userId, orderNumber, totalAmount.toFixed(2)).catch(err => {
        console.error('Failed to send order confirmation notification', err);
      });
    }

    // 7b. Emit domain event → Sales Team alert + audit.
    eventBus.emit('order.placed', {
      actor: { id: userId, fullName: null, role: 'customer' },
      resourceType: 'order',
      resourceId: createdOrder.id,
      actionType: 'CREATE',
      severity: 'info',
      title: 'New Order',
      message: `Order #${orderNumber} placed${userId ? '' : ' (guest)'} — total ${totalAmount.toFixed(2)}.`,
      data: { orderId: createdOrder.id, orderNumber, total: totalAmount, userId },
      deepLink: `/orders/${createdOrder.id}`,
    });

    return {
      checkoutSession: {
        id: checkoutSessionId,
        orderId: createdOrder.id,
        total: totalAmount,
        breakdown: {
          subtotal: validation.subtotal,
          shipping: shippingCost,
          tax: taxAmount,
          discount: discountAmount
        },
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 mins
      }
    };
  }

  /**
   * Release any inventory reservations held for a checkout session that has
   * been abandoned (frontend timeout without completing payment).
   */
  async expireCheckoutSession(sessionId) {
    await InventoryReservationService.releaseSessionReservations(sessionId);
  }

  async getShippingCost(option, cartTotal = 0) {
    if (!option) return 0;
    
    // Check if it's a UUID (database rate)
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(option)) {
      try {
        const rate = await shippingRateModel.findById(option);
        if (rate && rate.min_order_amount && cartTotal >= rate.min_order_amount && rate.rate == 0) {
            return 0; // Free shipping
        }
        return rate ? parseFloat(rate.rate) : 0;
      } catch (err) {
        return 0;
      }
    }

    // Fallback to legacy hardcoded options
    const costs = {
      'standard': Number(process.env.SHIPPING_COST_STANDARD || 1500),
      'express': Number(process.env.SHIPPING_COST_EXPRESS || 3500),
      'pickup': 0
    };
    return costs[option] || Number(process.env.SHIPPING_COST_STANDARD || 1500);
  }

   async calculateTax(subtotal, address = null) {
     try {
       let taxRate = null;
       if (address && address.country) {
         const { data: rule } = await supabase
           .from('tax_rules')
           .select('rate')
           .eq('country', address.country)
           .eq('state', address.state || '')
           .eq('is_active', true)
           .maybeSingle();

         if (rule) {
           taxRate = Number(rule.rate);
         } else if (address.state) {
           // Fallback to country-wide rule (state is null)
           const { data: countryRule } = await supabase
             .from('tax_rules')
             .select('rate')
             .eq('country', address.country)
             .is('state', null)
             .eq('is_active', true)
             .maybeSingle();

           if (countryRule) {
             taxRate = Number(countryRule.rate);
           }
         }
       }

       if (taxRate === null) {
         const settings = await SettingService.getPublicSettingsStructured();
         const defaultTaxRate = Number(process.env.DEFAULT_TAX_RATE || 0.075);
         taxRate = settings.tax?.default_rate !== undefined ? settings.tax.default_rate : defaultTaxRate;
       }

       return parseFloat((subtotal * taxRate).toFixed(2));
     } catch (error) {
       const fallbackTaxRate = Number(process.env.DEFAULT_TAX_RATE || 0.075);
       console.warn(`Failed to calculate tax rate, using fallback: ${fallbackTaxRate * 100}%`, error.message);
       return parseFloat((subtotal * fallbackTaxRate).toFixed(2));
     }
   }
}

module.exports = new CheckoutService();
