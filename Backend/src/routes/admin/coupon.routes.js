const express = require('express');
const router = express.Router();
const adminCouponController = require('../../controllers/admin/coupon.admin.controller');
const requireAdmin = require('../../middlewares/require-admin.middleware');
const { hasPermission } = require('../../middlewares/permission.middleware');
const joi = require('joi');

const validateRequest = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({ success: false, error: error.details[0].message });
  }
  next();
};

const createSchema = joi.object({
  code: joi.string().required(),
  type: joi.string().valid('percentage', 'fixed').required(),
  value: joi.number().positive().required(),
  description: joi.string().optional().allow(''),
  min_order_amount: joi.number().min(0).optional(),
  max_discount: joi.number().min(0).optional(),
  starts_at: joi.date().iso().optional(),
  expires_at: joi.date().iso().optional(),
  usage_limit: joi.number().integer().min(1).optional(),
  per_customer_limit: joi.number().integer().min(1).optional(),
  applicable_category: joi.string().optional().allow(''),
  stackable: joi.boolean().optional(),
  is_active: joi.boolean().optional()
});

const updateSchema = createSchema.fork(Object.keys(createSchema.describe().keys), (schema) => schema.optional());

const bulkSchema = joi.object({
  prefix: joi.string().required(),
  count: joi.number().integer().min(1).max(1000).required(),
  type: joi.string().valid('percentage', 'fixed').required(),
  value: joi.number().positive().required(),
  expiresAt: joi.date().iso().optional(),
  usageLimitPerCode: joi.number().integer().min(1).optional(),
  minOrderAmount: joi.number().min(0).optional()
});

router.use(requireAdmin);
// router.use(hasPermission('coupon:write')); // Optional RBAC

/**
 * @swagger
 * tags:
 *   name: Admin Coupons
 *   description: Admin management of coupons
 */

/**
 * @swagger
 * /api/v1/admin/coupons:
 *   get:
 *     summary: List all coupons (with filtering)
 *     tags: [Admin Coupons]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Paginated list of coupons
 *   post:
 *     summary: Create a single new coupon
 *     tags: [Admin Coupons]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Coupon created
 */
router.get('/', adminCouponController.getAllCoupons);
router.post('/', validateRequest(createSchema), adminCouponController.createCoupon);

/**
 * @swagger
 * /api/v1/admin/coupons/bulk-generate:
 *   post:
 *     summary: Generate multiple unique coupon codes
 *     tags: [Admin Coupons]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Bulk coupons created
 */
router.post('/bulk-generate', validateRequest(bulkSchema), adminCouponController.bulkGenerate);

/**
 * @swagger
 * /api/v1/admin/coupons/{id}:
 *   get:
 *     summary: Get coupon details
 *     tags: [Admin Coupons]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Coupon details
 *   patch:
 *     summary: Update a coupon
 *     tags: [Admin Coupons]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Updated coupon
 *   delete:
 *     summary: Hard delete a coupon
 *     tags: [Admin Coupons]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Coupon deleted
 */
router.get('/:id', adminCouponController.getCouponById);
router.patch('/:id', validateRequest(updateSchema), adminCouponController.updateCoupon);
router.delete('/:id', adminCouponController.deleteCoupon);

/**
 * @swagger
 * /api/v1/admin/coupons/{id}/deactivate:
 *   post:
 *     summary: Soft delete / deactivate a coupon
 *     tags: [Admin Coupons]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Coupon deactivated
 */
router.post('/:id/deactivate', adminCouponController.deactivateCoupon);

/**
 * @swagger
 * /api/v1/admin/coupons/{id}/usage:
 *   get:
 *     summary: Get usage analytics for a coupon
 *     tags: [Admin Coupons]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Coupon analytics
 */
router.get('/:id/usage', adminCouponController.getUsageAnalytics);

module.exports = router;
