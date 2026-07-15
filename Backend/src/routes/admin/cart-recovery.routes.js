const express = require('express');
const router = express.Router();
const adminCartRecoveryController = require('../../controllers/admin/cart-recovery.controller');
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

const settingsSchema = joi.object({
  enabled: joi.boolean().optional(),
  delayHours: joi.number().integer().min(1).max(720).optional()
});

router.use(requireAdmin);

/**
 * @swagger
 * tags:
 *   name: Admin Cart Recovery
 *   description: Admin visibility and configuration for abandoned-cart reminder emails
 */

/**
 * @swagger
 * /admin/cart-recovery:
 *   get:
 *     summary: List abandoned carts
 *     tags: [Admin Cart Recovery]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: List of abandoned carts
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/', hasPermission('marketing:read'), adminCartRecoveryController.getAbandonedCarts);

/**
 * @swagger
 * /admin/cart-recovery/settings:
 *   get:
 *     summary: Get abandoned-cart reminder email settings
 *     tags: [Admin Cart Recovery]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current settings
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/settings', hasPermission('marketing:read'), adminCartRecoveryController.getSettings);

/**
 * @swagger
 * /admin/cart-recovery/settings:
 *   patch:
 *     summary: Update abandoned-cart reminder email settings
 *     tags: [Admin Cart Recovery]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               enabled: { type: boolean }
 *               delayHours: { type: integer, minimum: 1, maximum: 720 }
 *     responses:
 *       200:
 *         description: Settings updated
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.patch('/settings', hasPermission('marketing:write'), validateRequest(settingsSchema), adminCartRecoveryController.updateSettings);

/**
 * @swagger
 * /admin/cart-recovery/trigger:
 *   post:
 *     summary: Manually trigger abandoned-cart reminder emails now
 *     tags: [Admin Cart Recovery]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Reminder job triggered
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.post('/trigger', hasPermission('marketing:write'), adminCartRecoveryController.triggerNow);

module.exports = router;
