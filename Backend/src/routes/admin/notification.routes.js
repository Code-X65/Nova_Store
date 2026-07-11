const express = require('express');
const router = express.Router();
const adminNotificationController = require('../../controllers/admin/notification.admin.controller');
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

const templateSchema = joi.object({
  key: joi.string().required(),
  name: joi.string().required(),
  subject: joi.string().required(),
  html_template: joi.string().optional().allow(null, ''),
  text_template: joi.string().required(),
  variables: joi.array().items(joi.string()).optional(),
  channel: joi.array().items(joi.string().valid('email', 'sms', 'inapp')).optional(),
  is_active: joi.boolean().optional()
});

const sendSchema = joi.object({
  userId: joi.string().uuid().optional().allow(null),
  type: joi.string().required(),
  title: joi.string().required(),
  message: joi.string().required(),
  channel: joi.array().items(joi.string().valid('email', 'sms', 'inapp')).optional(),
  data: joi.object().optional()
});

const broadcastSchema = joi.object({
  title: joi.string().required(),
  message: joi.string().required(),
  channels: joi.array().items(joi.string().valid('email', 'sms', 'inapp')).required(),
  filter: joi.object().optional()
});

router.use(requireAdmin);

/**
 * @swagger
 * tags:
 *   name: Admin Notifications
 *   description: Admin management of system notifications and templates
 */

/**
 * @swagger
 * /admin/notifications:
 *   get:
 *     summary: List all notifications across the system
 *     tags: [Admin Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of system notifications
 */
router.get('/', adminNotificationController.getAllNotifications);

/**
 * @swagger
 * /admin/notifications/send:
 *   post:
 *     summary: Send a custom notification to a user
 *     tags: [Admin Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Notification sent
 */
router.post('/send', validateRequest(sendSchema), adminNotificationController.sendNotification);

/**
 * @swagger
 * /admin/notifications/broadcast:
 *   post:
 *     summary: Broadcast a notification to all/filtered users
 *     tags: [Admin Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Broadcast sent
 */
router.post('/broadcast', validateRequest(broadcastSchema), adminNotificationController.broadcast);

/**
 * @swagger
 * /admin/notifications/test-email:
 *   post:
 *     summary: Send a test email using a specific template
 *     tags: [Admin Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Test email sent
 */
router.post('/test-email', adminNotificationController.testEmail);

/**
 * @swagger
 * /admin/notifications/health:
 *   get:
 *     summary: Notification queue health metrics
 *     description: Returns the number of pending and in-flight async notification jobs.
 *     tags: [Admin Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Queue health snapshot
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     queue:
 *                       type: object
 *                       properties:
 *                         pending:  { type: integer, description: Jobs waiting to be dispatched }
 *                         inflight: { type: integer, description: Jobs currently being processed }
 *                         status:   { type: string, enum: [healthy, degraded] }
 *                     timestamp: { type: string, format: date-time }
 */
router.get('/health', adminNotificationController.getQueueHealth);


/**
 * @swagger
 * /admin/notifications/templates:
 *   get:
 *     summary: Get all notification templates
 *     tags: [Admin Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of templates
 *   post:
 *     summary: Create a new notification template
 *     tags: [Admin Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Template created
 */
router.get('/routing-rules', adminNotificationController.getRoutingRules);
router.patch('/routing-rules/:id', adminNotificationController.updateRoutingRule);
router.post('/templates', validateRequest(templateSchema), adminNotificationController.createTemplate);

/**
 * @swagger
 * /admin/notifications/templates/{id}:
 *   patch:
 *     summary: Update a notification template
 *     tags: [Admin Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Template updated
 *   delete:
 *     summary: Delete a notification template
 *     tags: [Admin Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Template deleted
 */
router.patch('/templates/:id', adminNotificationController.updateTemplate);
router.delete('/templates/:id', adminNotificationController.deleteTemplate);

module.exports = router;
