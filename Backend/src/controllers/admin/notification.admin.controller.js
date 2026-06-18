const NotificationModel = require('../../models/notification.model');
const NotificationTemplateModel = require('../../models/notification-template.model');
const NotificationService = require('../../services/notification.service');
const notificationQueue = require('../../services/notification-queue.service');


exports.getAllNotifications = async (req, res, next) => {
  try {
    const { userId, type, status, channel, page, limit } = req.query;
    const filters = { userId, type, status, channel };

    const result = await NotificationModel.findAllSystemWide(filters, {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20
    });

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

exports.sendNotification = async (req, res, next) => {
  try {
    const { userId, type, title, message, channel, data } = req.body;
    
    // Simplification for ad-hoc messages
    const notif = await NotificationModel.create({
      user_id: userId || null,
      type: type || 'custom_message',
      title,
      message,
      channel: channel || ['inapp'],
      data: data || {},
      status: 'sent',
      sent_at: new Date().toISOString()
    });

    res.status(201).json({ success: true, data: { notification: notif } });
  } catch (error) {
    next(error);
  }
};

exports.broadcast = async (req, res, next) => {
  try {
    const { title, message, channels, filter } = req.body;
    const result = await NotificationService.broadcast(title, message, channels, filter);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

exports.getTemplates = async (req, res, next) => {
  try {
    const templates = await NotificationTemplateModel.findAll();
    res.status(200).json({ success: true, data: { templates } });
  } catch (error) {
    next(error);
  }
};

exports.createTemplate = async (req, res, next) => {
  try {
    const template = await NotificationTemplateModel.create(req.body);
    res.status(201).json({ success: true, data: { template } });
  } catch (error) {
    next(error);
  }
};

exports.updateTemplate = async (req, res, next) => {
  try {
    const template = await NotificationTemplateModel.update(req.params.id, req.body);
    res.status(200).json({ success: true, data: { template } });
  } catch (error) {
    next(error);
  }
};

exports.deleteTemplate = async (req, res, next) => {
  try {
    await NotificationTemplateModel.delete(req.params.id);
    res.status(200).json({ success: true, data: {}, message: 'Template deleted' });
  } catch (error) {
    next(error);
  }
};

exports.testEmail = async (req, res, next) => {
  try {
    const { templateKey, recipientEmail } = req.body;
    const EmailService = require('../../services/email.service');
    
    await EmailService.sendTemplate(templateKey, recipientEmail, {
      orderNumber: 'TEST-12345',
      trackingNumber: 'TRK99999',
      carrier: 'UPS',
      totalAmount: '99.99',
      resetLink: 'https://example.com/reset',
      productName: 'Test Product',
      stockQuantity: '2',
      reason: 'Testing email template'
    });

    res.status(200).json({ success: true, data: {}, message: `Test email sent to ${recipientEmail}` });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /admin/notifications/health
 * Returns real-time metrics for the async notification queue.
 */
exports.getQueueHealth = async (req, res, next) => {
  try {
    const stats = await notificationQueue.getQueueStats();
    res.status(200).json({
      success: true,
      data: {
        queue: {
          pending:  stats.pending,
          inflight: stats.inflight,
          failed:   stats.failed,
          // A high inflight count relative to pending may indicate stuck jobs
          status: stats.inflight > 100 ? 'degraded' : 'healthy',
        },
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
};

