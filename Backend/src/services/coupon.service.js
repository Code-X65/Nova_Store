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

   async validateAndApplyCoupon(userId, cartId, code, cartTotal = null, customerEmail = null) {
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

     // Get cart total if not provided
     let actualCartTotal = cartTotal;
     if (actualCartTotal === null) {
       const cart = await CartService.getOrCreateCart(userId, null);
       actualCartTotal = cart.subtotal;
     }

     if (coupon.min_order_amount && actualCartTotal < coupon.min_order_amount) {
       throw new ErrorResponse(`Minimum order amount for this coupon is ${coupon.min_order_amount}`, 400);
     }

     let discount = 0;
     if (coupon.type === 'percentage') {
       discount = (actualCartTotal * coupon.value) / 100;
       if (coupon.max_discount && discount > coupon.max_discount) {
         discount = coupon.max_discount;
       }
     } else {
       discount = coupon.value;
     }

     return {
       coupon,
       discount: parseFloat(discount.toFixed(2)),
       newTotal: parseFloat((actualCartTotal - discount).toFixed(2))
     };
   }

  /**
   * Record coupon usage after a successful order.
   * Must be called by checkout/payment services — not by validateAndApplyCoupon alone.
   */
  async recordCouponUsage(userId, couponId) {
    await CouponModel.incrementUsage(couponId);
    if (userId) {
      await CouponModel.logUserUsage(userId, couponId);
    }
  }

  // Admin Operations
  async getAllCoupons(filters, pagination) {
    return await CouponModel.findAll(filters, pagination);
  }

  async getCouponById(id) {
    return await CouponModel.getUsageAnalytics(id); // Using the analytics method since it returns coupon + usage
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
