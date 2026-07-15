const CouponModel = require('../models/coupon.model');
const CartService = require('./cart.service');
const ErrorResponse = require('../utils/errorResponse');
const supabase = require('../config/supabase');

class CouponService {
  async getAvailableCoupons(userId, minOrderAmount = 0) {
    const coupons = await CouponModel.findAvailableForUser(userId);
    
    // Use the RPC to filter out invalid ones (like per_customer_limit exceeded)
    const validCoupons = [];
    for (const coupon of coupons) {
      if (minOrderAmount > 0 && coupon.min_order_amount > minOrderAmount) {
        continue;
      }
      
      const { data: isValid, error } = await supabase.rpc('is_coupon_valid_for_user', {
        p_coupon_id: coupon.id,
        p_user_id: userId,
        p_cart_total: minOrderAmount || 0
      });

      if (!error && isValid) {
        validCoupons.push({
          id: coupon.id,
          code: coupon.code,
          type: coupon.type,
          value: parseFloat(coupon.value),
          description: coupon.description,
          minOrderAmount: parseFloat(coupon.min_order_amount),
          maxDiscount: coupon.max_discount ? parseFloat(coupon.max_discount) : null,
          expiresAt: coupon.expires_at,
          applicableCategory: coupon.applicable_category
        });
      }
    }
    
    return validCoupons;
  }

  async getMyCoupons(userId) {
    return await CouponModel.findUserHistory(userId);
  }

   async validateAndApplyCoupon(userId, sessionId, code, cartTotal = null, customerEmail = null) {
     const coupon = await CouponModel.findByCode(code);
     if (!coupon) throw new ErrorResponse('Invalid coupon code', 400);

     const now = new Date();
     if (coupon.starts_at && new Date(coupon.starts_at) > now) throw new ErrorResponse('Coupon not yet active', 400);
     if (coupon.expires_at && new Date(coupon.expires_at) < now) throw new ErrorResponse('Coupon expired', 400);
     if (coupon.usage_limit && coupon.used_count >= coupon.usage_limit) throw new ErrorResponse('Coupon usage limit reached', 400);

     // Determine customer identifier for per-customer limit checks
     let customerIdentifier = null;
     let identifierType = null; // 'userId' or 'customerEmail'
     
     if (userId) {
       customerIdentifier = userId;
       identifierType = 'userId';
     } else if (customerEmail) {
       customerIdentifier = customerEmail.toLowerCase().trim();
       identifierType = 'customerEmail';
     }
     // If neither is provided, we cannot enforce per-customer limits, but we should still proceed
     // with other validations (this maintains backward compatibility for guest checkouts without email)

     if (userId) {
       // Check per customer limit for registered users
       if (coupon.per_customer_limit) {
         const { data: isValid, error } = await supabase.rpc('is_coupon_valid_for_user', {
           p_coupon_id: coupon.id,
           p_user_id: userId,
           p_cart_total: cartTotal || 0
         });

         if (error) throw new ErrorResponse('Error validating coupon eligibility', 500);
         if (!isValid) throw new ErrorResponse('You are not eligible for this coupon or usage limit reached', 400);
       } else {
         // Fallback for legacy (just check if used once if no limit specified but previously logic applied)
         const userUsage = await CouponModel.checkUserUsage(userId, coupon.id);
         if (userUsage) throw new ErrorResponse('You have already used this coupon', 400);
       }
     } else if (customerEmail) {
       // Guest coupon abuse check using email
       if (coupon.per_customer_limit) {
         const { data: guestOrders, error: guestOrdersError } = await supabase
           .from('orders')
           .select('id')
           .eq('customer_email', customerEmail)
           .eq('coupon_id', coupon.id)
           .not('status', 'eq', 'cancelled')
           .not('payment_status', 'eq', 'failed');

         if (guestOrdersError) throw new ErrorResponse('Error validating coupon eligibility', 500);
         if (guestOrders && guestOrders.length >= coupon.per_customer_limit) {
           throw new ErrorResponse('You are not eligible for this coupon or usage limit reached', 400);
         }
       }
     }
     // Note: If neither userId nor customerEmail is provided, we skip per-customer limit checks
     // but continue with other validations (min_order_amount, etc.)

     // Load the cart whenever we have identity to do so — needed both as a
     // cartTotal fallback and (below) to enforce product/category scoping,
     // which requires per-item detail that a pre-computed cartTotal can't provide.
     let cart = null;
     if (userId || sessionId) {
       cart = await CartService.getOrCreateCart(userId, sessionId);
     }

     let actualCartTotal = cartTotal;
     if (actualCartTotal === null) {
       actualCartTotal = cart ? cart.subtotal : 0;
     }

     if (coupon.min_order_amount && actualCartTotal < coupon.min_order_amount) {
       throw new ErrorResponse(`Minimum order amount for this coupon is ${coupon.min_order_amount}`, 400);
     }

     // A coupon scoped to specific products/categories only discounts the
     // eligible items' subtotal, not the whole cart — previously the full
     // cartTotal was discounted regardless of what applicable_product_ids/
     // applicable_category restricted it to.
     const hasScope = (coupon.applicable_product_ids && coupon.applicable_product_ids.length > 0) || !!coupon.applicable_category;
     let discountBase = actualCartTotal;
     let eligibleItems = cart ? cart.items : [];

     if (hasScope) {
       if (!cart) {
         throw new ErrorResponse('Unable to verify coupon eligibility for your cart', 400);
       }
       eligibleItems = cart.items.filter((item) => {
         const inProducts = coupon.applicable_product_ids && coupon.applicable_product_ids.length > 0
           && coupon.applicable_product_ids.includes(item.productId);
         const inCategory = coupon.applicable_category
           && (item.product?.category_id === coupon.applicable_category || item.product?.subcategory_id === coupon.applicable_category);
         return inProducts || inCategory;
       });
       if (eligibleItems.length === 0) {
         throw new ErrorResponse('No items in your cart are eligible for this coupon', 400);
       }
       discountBase = eligibleItems.reduce((sum, item) => sum + item.total, 0);
     }

     let discount = 0;
     if (coupon.type === 'percentage') {
       discount = (discountBase * coupon.value) / 100;
       if (coupon.max_discount && discount > coupon.max_discount) {
         discount = coupon.max_discount;
       }
     } else {
       // A fixed-amount discount must never exceed what's actually eligible.
       discount = Math.min(coupon.value, discountBase);
     }

     // Allocate the total discount back across eligible items proportionally
     // to each item's share of discountBase — needed by checkout so it can
     // compare this per-item against any active campaign discount on the same
     // item and apply only the larger one, rather than stacking both.
     const itemDiscounts = {};
     if (discountBase > 0) {
       for (const item of eligibleItems) {
         itemDiscounts[item.id] = parseFloat(((item.total / discountBase) * discount).toFixed(2));
       }
     }

     return {
       coupon,
       discount: parseFloat(discount.toFixed(2)),
       newTotal: parseFloat((actualCartTotal - discount).toFixed(2)),
       itemDiscounts
     };
   }

  /**
   * Atomically claim a coupon's usage slot (global usage_limit + per-customer
   * limit) at order-creation time. Must be called right after the order is
   * created, before the checkout response is returned to the client — this is
   * what actually closes the race between two concurrent checkouts both
   * passing validateAndApplyCoupon before either had recorded usage.
   * @returns {boolean} true if claimed, false if the coupon's limit was hit
   *   by another concurrent request in the meantime.
   */
  async claimCouponUsage(userId, couponId, orderId) {
    return await CouponModel.claimUsage(couponId, userId, orderId);
  }

  /**
   * Release a coupon usage that was claimed but never paid for (order
   * cancelled, or payment failed) — mirrors stock reservation release.
   */
  async releaseCouponUsage(couponId, orderId) {
    await CouponModel.releaseUsage(couponId, orderId);
  }

  /**
   * Confirm a claimed coupon usage after a successful order/payment.
   * Must be called by checkout/payment services — not by validateAndApplyCoupon alone.
   */
  async recordCouponUsage(userId, couponId, orderId = null) {
    await CouponModel.confirmUsage(couponId, orderId, userId);
  }

  // Admin Operations
  async getAllCoupons(filters, pagination) {
    return await CouponModel.findAll(filters, pagination);
  }

  async getCouponById(id) {
    return await CouponModel.findById(id);
  }

  async getCouponUsageAnalytics(id) {
    return await CouponModel.getUsageAnalytics(id);
  }

  async createCoupon(data) {
    return await CouponModel.create(data);
  }

  async updateCoupon(id, data) {
    return await CouponModel.update(id, data);
  }

  async deleteCoupon(id) {
    return await CouponModel.delete(id);
  }

  async deactivateCoupon(id) {
    return await CouponModel.deactivate(id);
  }

  async bulkGenerateCoupons(options) {
    const { prefix, count, type, value, expiresAt, usageLimitPerCode, minOrderAmount } = options;
    const generatedCodes = [];
    const couponsToInsert = [];

    for (let i = 0; i < count; i++) {
      const randomString = Math.random().toString(36).substring(2, 8).toUpperCase();
      const code = `${prefix}-${randomString}`;
      
      couponsToInsert.push({
        code,
        type,
        value,
        expires_at: expiresAt,
        usage_limit: usageLimitPerCode || 1,
        min_order_amount: minOrderAmount || 0,
        is_active: true
      });
      generatedCodes.push(code);
    }

    // Insert all in a loop (Supabase JS can insert arrays)
    const { data, error } = await supabase.from('coupons').insert(couponsToInsert);
    if (error) throw error;

    return generatedCodes;
  }
}

module.exports = new CouponService();
