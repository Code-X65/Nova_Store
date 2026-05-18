const CouponService = require('../services/coupon.service');

exports.getAvailableCoupons = async (req, res, next) => {
  try {
    const { minOrderAmount } = req.query;
    const coupons = await CouponService.getAvailableCoupons(
      req.user.id, 
      minOrderAmount ? parseFloat(minOrderAmount) : 0
    );
    res.status(200).json({ success: true, data: { coupons } });
  } catch (error) {
    next(error);
  }
};

exports.getMyCoupons = async (req, res, next) => {
  try {
    const history = await CouponService.getMyCoupons(req.user.id);
    res.status(200).json({ success: true, data: { history } });
  } catch (error) {
    next(error);
  }
};

exports.validateCoupon = async (req, res, next) => {
  try {
    const userId = req.user ? req.user.id : null;
    const { code, cartTotal, email } = req.body;
    
    const result = await CouponService.validateAndApplyCoupon(userId, null, code, cartTotal, email);
    
    // We return the same response as apply but didn't modify cart or order state (since it's just validation)
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};
