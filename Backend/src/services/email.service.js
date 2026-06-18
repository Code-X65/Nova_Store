const nodemailer = require('nodemailer');
const EmailLogModel = require('../models/email-log.model');
const NotificationTemplateModel = require('../models/notification-template.model');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp-relay.brevo.com',
      port: process.env.SMTP_PORT || 587,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  /**
   * Send an email-verification link to a new registrant.
   * Uses the 'email_verification' template from the DB; falls back to a
   * raw inline email if the template is not found so auth is never blocked.
   */
  async sendVerificationEmail(email, firstName, token) {
    const verificationLink = `${process.env.CLIENT_URL}/verify-email?token=${token}`;

    try {
      // Prefer the DB-managed template (logged, auditable)
      await this.sendTemplate('email_verification', email, { firstName, verificationLink });
    } catch (templateErr) {
      // If template lookup failed (e.g. not yet seeded), send raw HTML as fallback
      console.warn('[EmailService] email_verification template not found, using inline fallback:', templateErr.message);
      const mailOptions = {
        from: `"Nova Store" <${process.env.EMAIL_FROM || 'noreply@novastore.com'}>`,
        to: email,
        subject: 'Verify your email - Nova Store',
        html: `
          <h1>Welcome to Nova Store, ${firstName}!</h1>
          <p>Please click the link below to verify your email address:</p>
          <a href="${verificationLink}">${verificationLink}</a>
          <p>This link will expire in 24 hours.</p>
        `,
      };
      try {
        await this.transporter.sendMail(mailOptions);
        await EmailLogModel.log({
          recipient_email: email,
          subject: 'Verify your email - Nova Store',
          template_key: 'email_verification',
          status: 'sent',
          sent_at: new Date().toISOString(),
        });
        console.log(`Verification email sent to ${email} (inline fallback)`);
      } catch (error) {
        await EmailLogModel.log({
          recipient_email: email,
          subject: 'Verify your email - Nova Store',
          template_key: 'email_verification',
          status: 'failed',
          error: error.message,
        }).catch(() => {});
        console.error('Error sending verification email:', error);
        throw new Error('Failed to send verification email');
      }
    }
  }

  /**
   * Send a templated email and log the result.
   * This is the canonical send path — all other helpers call this.
   *
   * @param {string} templateKey  - Key that identifies the template in notification_templates
   * @param {string} to           - Recipient email address
   * @param {object} data         - Variable substitution map
   * @param {string|null} notificationId - Optional linked notification row ID
   */
  async sendTemplate(templateKey, to, data, notificationId = null) {
    try {
      const template = await NotificationTemplateModel.findByKey(templateKey);
      if (!template) throw new Error(`Template ${templateKey} not found`);

      let subject = template.subject;
      let html = template.html_template || template.text_template;

      for (const [key, value] of Object.entries(data)) {
        subject = subject.replace(new RegExp(`{{${key}}}`, 'g'), value);
        html = html.replace(new RegExp(`{{${key}}}`, 'g'), value);
      }

      const mailOptions = {
        from: `"Nova Store" <${process.env.EMAIL_FROM || 'noreply@novastore.com'}>`,
        to,
        subject,
        html,
      };

      await this.transporter.sendMail(mailOptions);

      await EmailLogModel.log({
        notification_id: notificationId,
        recipient_email: to,
        subject,
        template_key: templateKey,
        status: 'sent',
        sent_at: new Date().toISOString(),
      });

      console.log(`Email sent to ${to} using template ${templateKey}`);
    } catch (error) {
      console.error(`Error sending email to ${to}:`, error);

      await EmailLogModel.log({
        notification_id: notificationId,
        recipient_email: to,
        subject: templateKey,
        template_key: templateKey,
        status: 'failed',
        error: error.message,
      }).catch(() => {});
      throw error;
    }
  }

  async sendPasswordResetEmail(email, token) {

    const resetLink = `${process.env.CLIENT_URL}/reset-password?token=${token}`;
    try {
      await this.sendTemplate('password_reset', email, { resetLink });
    } catch (error) {
      console.error('Error sending password reset email:', error);
      throw new Error('Failed to send password reset email');
    }
  }

  /**
   * Send an email-change confirmation link to the new address.
   * Uses the 'email_change_verification' template from the DB; falls back to
   * a raw inline email if the template is not found.
   */
  async sendEmailChangeVerification(email, firstName, token) {
    const verificationUrl = `${process.env.CLIENT_URL}/verify-email-change?token=${token}`;

    try {
      await this.sendTemplate('email_change_verification', email, { firstName, verificationUrl });
    } catch (templateErr) {
      console.warn('[EmailService] email_change_verification template not found, using inline fallback:', templateErr.message);
      const mailOptions = {
        from: `"Nova Store" <${process.env.EMAIL_FROM || 'noreply@novastore.com'}>`,
        to: email,
        subject: 'Confirm your new email - Nova Store',
        html: `
          <h1>Email Change Request</h1>
          <p>Hello ${firstName},</p>
          <p>Please click the link below to confirm your new email address:</p>
          <a href="${verificationUrl}">${verificationUrl}</a>
          <p>This link will expire in 2 hours.</p>
          <p>If you didn't request this change, please ignore this email.</p>
        `,
      };
      try {
        await this.transporter.sendMail(mailOptions);
        await EmailLogModel.log({
          recipient_email: email,
          subject: 'Confirm your new email - Nova Store',
          template_key: 'email_change_verification',
          status: 'sent',
          sent_at: new Date().toISOString(),
        });
      } catch (error) {
        await EmailLogModel.log({
          recipient_email: email,
          subject: 'Confirm your new email - Nova Store',
          template_key: 'email_change_verification',
          status: 'failed',
          error: error.message,
        }).catch(() => {});
        console.error('Error sending email change verification:', error);
        throw new Error('Failed to send email change verification');
      }
    }
  }
}

module.exports = new EmailService();

