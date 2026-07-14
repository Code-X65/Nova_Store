const NotificationModel = require('../models/notification.model');
const NotificationSettingModel = require('../models/notification-setting.model');
const NotificationTemplateModel = require('../models/notification-template.model');
const EmailService = require('./email.service');
const SMSService = require('./sms.service');
const UserModel = require('../models/user.model');
const notificationQueue = require('./notification-queue.service');
const logger = require('../utils/logger');
const NotificationDeliveryModel = require('../models/notification-delivery.model');

class NotificationService {
  async sendToUser(userId, templateKey, data = {}, customTitle = null, customMessage = null, opts = {}) {
    // ── Async queue path ──────────────────────────────────────────────────────
    if (opts.async !== false) {
      try {
        await notificationQueue.enqueue({
          userId,
          templateKey,
          data,
          delayMs: opts.delayMs || 0,
          requestId: opts.requestId || null,
        });
        return true; // enqueued — worker handles delivery
      } catch (queueErr) {
        logger.warn('[Notification] Async enqueue failed; falling back to sync delivery:', queueErr.message);
        // fall through to synchronous path below
      }
    }

    // ── Synchronous (inline) path ─────────────────────────────────────────────
    let notificationId = null;
    const deliveryLogs = [];

    try {
      // 1. Get user and settings
      const user = await UserModel.findById(userId);
      if (!user) throw new Error('User not found');
      const settings = await NotificationSettingModel.getSettings(userId);

      // 2. Get template — findByKey only returns active templates
      const template = await NotificationTemplateModel.findByKey(templateKey);
      if (!template && !customTitle) {
        const anyTemplate = await NotificationTemplateModel.findByKeyAny(templateKey).catch(() => null);
        if (anyTemplate) {
          logger.warn(`[Notification] Template '${templateKey}' is deactivated — skipping notification for user ${userId}`);
        } else {
          logger.warn(`[Notification] Template '${templateKey}' not found — skipping notification for user ${userId}`);
        }
        throw new Error(`Template ${templateKey} not found or is deactivated`);
      }


      // 3. Render content
      let title = customTitle || template.subject;
      let message = customMessage || template.text_template;

      // Simple handlebar-like replacement
      for (const [key, value] of Object.entries(data)) {
        title = title.replace(new RegExp(`{{${key}}}`, 'g'), value);
        message = message.replace(new RegExp(`{{${key}}}`, 'g'), value);
      }

      // 4. Determine channels
      const channelsToUse = [];
      const templateChannels = template ? template.channel : ['inapp'];

      if (templateChannels.includes('inapp') && settings.inapp_all) {
        channelsToUse.push('inapp');
      }

      if (templateChannels.includes('email') && user.email) {
        channelsToUse.push('email');
      }

      if (templateChannels.includes('sms') && user.phone_number && settings.sms_order_updates) {
        channelsToUse.push('sms');
      }

      // 5. Create Notification Record (if inapp is used)
      if (channelsToUse.includes('inapp')) {
        const notif = await NotificationModel.create({
          user_id: userId,
          type: templateKey,
          title,
          message,
          data,
          channel: ['inapp'],
          status: 'sent',
          sent_at: new Date().toISOString()
        });
        notificationId = notif.id;
        deliveryLogs.push({ channel: 'inapp', status: 'sent', sentAt: new Date().toISOString() });
      }

      // 6. Send via Channels
      if (channelsToUse.includes('email')) {
        try {
          await EmailService.sendTemplate(templateKey, user.email, data, notificationId);
          deliveryLogs.push({ channel: 'email', status: 'sent', sentAt: new Date().toISOString() });
        } catch (emailErr) {
          deliveryLogs.push({ channel: 'email', status: 'failed', error: emailErr.message });
        }
      }

      if (channelsToUse.includes('sms')) {
        try {
          const smsResult = await SMSService.send(user.phone_number, message);
          const SmsLogModel = require('../models/sms-log.model');
          await SmsLogModel.log({
            notification_id: notificationId,
            phone: user.phone_number,
            message,
            provider_message_id: smsResult.messageId,
            provider: smsResult.provider,
            status: smsResult.success ? 'sent' : 'failed',
            error: smsResult.error
          });
          deliveryLogs.push({ channel: 'sms', status: smsResult.success ? 'sent' : 'failed', sentAt: new Date().toISOString(), error: smsResult.error });
        } catch (smsErr) {
          deliveryLogs.push({ channel: 'sms', status: 'failed', error: smsErr.message });
        }
      }

      return true;
    } catch (error) {
      logger.error('Failed to send notification:', error);
      deliveryLogs.push({ channel: 'system', status: 'failed', error: error.message });
      return false; // Swallow error for background task
    } finally {
      // Persist delivery audit trail
      for (const log of deliveryLogs) {
        try {
          await NotificationDeliveryModel.create({
            notificationId,
            userId,
            templateKey,
            channel: log.channel,
            status: log.status,
            error: log.error || null,
            sentAt: log.sentAt || null,
          });
        } catch (dbErr) {
          logger.error('[Notification] Failed to log delivery:', dbErr.message);
        }
      }
    }
  }

  async broadcast(title, message, channels = ['inapp'], filter = {}) {
    // This is simplified. In a real application with millions of users, this should use a queue.
    try {
      // Create a system-wide broadcast notification (user_id = NULL)
      if (channels.includes('inapp')) {
        await NotificationModel.create({
          user_id: null,
          type: 'broadcast',
          title,
          message,
          channel: ['inapp'],
          status: 'sent',
          sent_at: new Date().toISOString()
        });
      }
      
      // If email/sms, we would need to query users matching filter and queue messages
      // ... implementation omitted for brevity ...
      return { sentCount: 1 }; 
    } catch (error) {
      logger.error('Failed to broadcast:', error);
      throw error;
    }
  }

  // Wrappers for backward compatibility / easy usage
  async sendPasswordReset(userId, token) {
    const resetLink = `${process.env.CLIENT_URL}/reset-password?token=${token}`;
    return await this.sendToUser(userId, 'password_reset', { resetLink });
  }

  async sendOrderConfirmation(userId, orderNumber, totalAmount) {
    return await this.sendToUser(userId, 'order_created', { orderNumber, totalAmount });
  }

  // ─── Admin Invitation Emails ───────────────────────────────────────────────
  // These send directly via EmailService because the recipient may not yet be
  // a registered user in the system.

  /**
   * Send an admin invitation email.
   *
   * @param {object} params
   * @param {string} params.to          - Recipient email address
   * @param {string} params.inviteLink  - Full accept-invite URL
   * @param {string} params.inviterName - Display name of the inviting admin
   * @param {string} params.expiryDate  - Human-readable expiry date string
   */
  async sendAdminInvitationEmail({ to, inviteLink, inviterName, expiryDate }) {
    try {
      await EmailService.sendTemplate('admin_invitation', to, {
        inviteLink,
        inviterName,
        expiryDate,
        storeName: process.env.STORE_NAME || 'Nova Store'
      });
      return true;
    } catch (err) {
      logger.error(`[NotificationService] Failed to send admin invitation email to ${to}:`, err.message);
      return false;
    }
  }

  /**
   * Notify the inviting admin that their invitation was accepted.
   *
   * @param {object} params
   * @param {string} params.to             - Inviter's email
   * @param {string} params.newAdminName   - Display name of the new admin
   * @param {string} params.newAdminEmail  - Email of the new admin
   */
  async sendAdminInvitationAcceptedEmail({ to, newAdminName, newAdminEmail }) {
    try {
      await EmailService.sendTemplate('admin_invitation_accepted', to, {
        newAdminName,
        newAdminEmail,
        storeName: process.env.STORE_NAME || 'Nova Store'
      });
      return true;
    } catch (err) {
      logger.error(`[NotificationService] Failed to send invitation-accepted email to ${to}:`, err.message);
      return false;
    }
  }

  /**
   * Notify the invitee that their invitation has been revoked.
   *
   * @param {object} params
   * @param {string} params.to - Invitee's email
   */
  async sendAdminInvitationRevokedEmail({ to }) {
    try {
      await EmailService.sendTemplate('admin_invitation_revoked', to, {
        storeName: process.env.STORE_NAME || 'Nova Store'
      });
      return true;
    } catch (err) {
      logger.error(`[NotificationService] Failed to send invitation-revoked email to ${to}:`, err.message);
      return false;
    }
  }

  /**
   * Notify the staff member that their role has been updated.
   *
   * @param {object} params
   * @param {string} params.to - Staff member's email
   * @param {string} params.newRole - The new assigned role
   */
  async sendAdminRoleUpdatedEmail({ to, newRole }) {
    try {
      await EmailService.sendTemplate('admin_role_updated', to, {
        newRole,
        storeName: process.env.STORE_NAME || 'Nova Store'
      });
      return true;
    } catch (err) {
      logger.error(`[NotificationService] Failed to send role updated email to ${to}:`, err.message);
      return false;
    }
  }

  /**
   * Notify the staff member that their access has been revoked.
   *
   * @param {object} params
   * @param {string} params.to - Departed staff member's email
   */
  async sendAdminAccessRevokedEmail({ to }) {
    try {
      await EmailService.sendTemplate('admin_access_revoked', to, {
        storeName: process.env.STORE_NAME || 'Nova Store'
      });
      return true;
    } catch (err) {
      logger.error(`[NotificationService] Failed to send access revoked email to ${to}:`, err.message);
      return false;
    }
  }
}

module.exports = new NotificationService();
