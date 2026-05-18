const CouponService = require('../../services/coupon.service');
const AuditService = require('../../services/audit.service');

exports.getAllCoupons = async (req, res, next) => {
  try {
    const { isActive, code, type, page, limit } = req.query;
    const filters = {};
    if (isActive !== undefined) filters.isActive = isActive === 'true';
    if (code) filters.code = code;
    if (type) filters.type = type;

    const result = await CouponService.getAllCoupons(filters, {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20
    });
    
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

exports.createCoupon = async (req, res, next) => {
  try {
    const coupon = await CouponService.createCoupon(req.body);
    AuditService.log(req, 'coupon.created', 'coupon', coupon.id, null, req.body);
    res.status(201).json({ success: true, data: { coupon } });
  } catch (error) {
    next(error);
  }
};

exports.getCouponById = async (req, res, next) => {
  try {
    const analytics = await CouponService.getCouponById(req.params.id);
    res.status(200).json({ success: true, data: analytics });
  } catch (error) {
    next(error);
  }
};

exports.updateCoupon = async (req, res, next) => {
  try {
    const coupon = await CouponService.updateCoupon(req.params.id, req.body);
    AuditService.log(req, 'coupon.updated', 'coupon', req.params.id, null, req.body);
    res.status(200).json({ success: true, data: { coupon } });
  } catch (error) {
    next(error);
  }
};

exports.deleteCoupon = async (req, res, next) => {
  try {
    await CouponService.deleteCoupon(req.params.id);
    AuditService.log(req, 'coupon.deleted', 'coupon', req.params.id);
    res.status(200).json({ success: true, data: {}, message: 'Coupon deleted' });
  } catch (error) {
    next(error);
  }
};

exports.deactivateCoupon = async (req, res, next) => {
  try {
    const coupon = await CouponService.deactivateCoupon(req.params.id);
    AuditService.log(req, 'coupon.deactivated', 'coupon', req.params.id);
    res.status(200).json({ success: true, data: { coupon }, message: 'Coupon deactivated' });
  } catch (error) {
    next(error);
  }
};

exports.getUsageAnalytics = async (req, res, next) => {
  try {
    const analytics = await CouponService.getCouponById(req.params.id);
    res.status(200).json({ success: true, data: analytics });
  } catch (error) {
    next(error);
  }
};

exports.bulkGenerate = async (req, res, next) => {
  try {
    const codes = await CouponService.bulkGenerateCoupons(req.body);
    AuditService.log(req, 'coupon.bulk_generated', 'coupon', null, null, { count: codes.length, ...req.body });
    res.status(201).json({ success: true, data: { codes }, message: `${codes.length} coupons generated` });
  } catch (error) {
    next(error);
  }
};
