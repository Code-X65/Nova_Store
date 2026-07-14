const NotificationModel = require('../../models/notification.model');
const NotificationTemplateModel = require('../../models/notification-template.model');
const NotificationService = require('../../services/notification.service');
const notificationQueue = require('../../services/notification-queue.service');
const AuditService = require('../../services/audit.service');
const { supabaseAdmin } = require('../../config/supabase');

exports.getRoutingRules = async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('notification_routing_rules')
      .select('*')
      .order('event_key', { ascending: true });
    if (error) throw error;
    res.status(200).json({ success: true, data: { rules: data || [] } });
  } catch (error) {
    next(error);
  }
};

exports.updateRoutingRule = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { is_active, severity, recipient_roles, channel } = req.body;
    const patch = {};
    if (typeof is_active === 'boolean') patch.is_active = is_active;
    if (severity) patch.severity = severity;
    if (Array.isArray(recipient_roles)) patch.recipient_roles = recipient_roles;
    if (Array.isArray(channel)) patch.channel = channel;
    patch.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('notification_routing_rules')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;

    AuditService.log(req, 'notification.routing_rule.updated', 'notification_routing_rule', id, null, patch);
    res.status(200).json({ success: true, data: { rule: data } });
  } catch (error) {
    next(error);
  }
};


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

    AuditService.log(req, 'notification.sent', 'notification', notif.id, null, { userId: userId || null, type, title, channel: channel || ['inapp'] });
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
    AuditService.log(req, 'notification.template.created', 'notification_template', template.id, null, { key: template.key, name: template.name, channel: template.channel });
    res.status(201).json({ success: true, data: { template } });
  } catch (error) {
    next(error);
  }
};

exports.updateTemplate = async (req, res, next) => {
  try {
    const oldTemplate = await NotificationTemplateModel.findByKeyAny(req.params.id);
    const template = await NotificationTemplateModel.update(req.params.id, req.body);

    const oldValues = oldTemplate ? { key: oldTemplate.key, name: oldTemplate.name, subject: oldTemplate.subject, channel: oldTemplate.channel, is_active: oldTemplate.is_active } : null;
    const newValues = { key: template.key, name: template.name, subject: template.subject, channel: template.channel, is_active: template.is_active };

    AuditService.log(req, 'notification.template.updated', 'notification_template', req.params.id, oldValues, newValues);
    res.status(200).json({ success: true, data: { template } });
  } catch (error) {
    next(error);
  }
};

exports.deleteTemplate = async (req, res, next) => {
  try {
    const template = await NotificationTemplateModel.findByKeyAny(req.params.id);
    await NotificationTemplateModel.delete(req.params.id);
    AuditService.log(req, 'notification.template.deleted', 'notification_template', req.params.id, null, { key: template?.key, name: template?.name });
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

