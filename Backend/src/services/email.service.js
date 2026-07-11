const nodemailer = require('nodemailer');
const EmailLogModel = require('../models/email-log.model');
const NotificationTemplateModel = require('../models/notification-template.model');

// Guard against a hung SMTP server blocking the event loop forever.
function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

class EmailService {
  constructor() {
    this.fromEmail = process.env.EMAIL_FROM || 'noreply@novastore.com';
    this.fromName = process.env.STORE_NAME || 'Nova Store';
    this.brevoApiKey = process.env.BREVO_API_KEY;
    this.brevoApiUrl = 'https://api.brevo.com/v3/smtp/email';

    // Use the Brevo REST API (API key) when configured; otherwise fall back
    // to the SMTP relay so the app keeps working in environments without a key.
    if (!this.brevoApiKey) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp-relay.brevo.com',
        port: process.env.SMTP_PORT || 587,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
        connectionTimeout: 5000,
        greetingTimeout: 5000,
        socketTimeout: 5000,
      });
    }
  }

  /**
   * Send a raw email. Uses the Brevo Transactional Emails API when
   * BREVO_API_KEY is set, otherwise falls back to the SMTP relay.
   *
   * @param {object} params
   * @param {string} params.to
   * @param {string} params.subject
   * @param {string} [params.html]
   * @param {string} [params.text]
   */
  async sendRaw({ to, subject, html, text }) {
    if (this.brevoApiKey) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);
      let res;
      try {
        res = await fetch(this.brevoApiUrl, {
          method: 'POST',
          headers: {
            'api-key': this.brevoApiKey,
            accept: 'application/json',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            sender: { name: this.fromName, email: this.fromEmail },
            to: [{ email: to }],
            subject,
            ...(html ? { htmlContent: html } : {}),
            ...(text ? { textContent: text } : {}),
          }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Brevo API responded ${res.status}: ${body}`);
      }
      return;
    }

    await withTimeout(
      this.transporter.sendMail({
        from: `"${this.fromName}" <${this.fromEmail}>`,
        to,
        subject,
        ...(html ? { html } : {}),
        ...(text ? { text } : {}),
      }),
      10000,
      'SMTP send'
    );
  }

  /**
   * Verify the configured email transport is reachable.
   * For the Brevo API this pings the account endpoint; for SMTP it uses
   * nodemailer's transporter.verify().
   */
  async verifyConnection() {
    if (this.brevoApiKey) {
      const res = await fetch('https://api.brevo.com/v3/account', {
        headers: { 'api-key': this.brevoApiKey, accept: 'application/json' },
      });
      if (!res.ok) throw new Error(`Brevo API responded ${res.status}`);
      return true;
    }
    if (!this.transporter) throw new Error('No email transport configured');
    await this.transporter.verify();
    return true;
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

      await this.sendRaw({ to, subject, html });

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

  /**
   * Send an email-verification link to a new registrant.
   * Uses the 'email_verification' template from the DB; falls back to a
   * raw inline email if the template is not found so auth is never blocked.
   */
  async sendVerificationEmail(email, firstName, token) {
    const verificationLink = `${process.env.CLIENT_URL}/verify-email?token=${token}`;

    try {
      await this.sendTemplate('email_verification', email, { firstName, verificationLink });
    } catch (templateErr) {
      console.warn('[EmailService] email_verification template not found, using inline fallback:', templateErr.message);
      const html = `
        <h1>Welcome to Nova Store, ${firstName}!</h1>
        <p>Please click the link below to verify your email address:</p>
        <a href="${verificationLink}">${verificationLink}</a>
        <p>This link will expire in 24 hours.</p>
      `;
      try {
        await this.sendRaw({ to: email, subject: 'Verify your email - Nova Store', html });
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
      const html = `
        <h1>Email Change Request</h1>
        <p>Hello ${firstName},</p>
        <p>Please click the link below to confirm your new email address:</p>
        <a href="${verificationUrl}">${verificationUrl}</a>
        <p>This link will expire in 2 hours.</p>
        <p>If you didn't request this change, please ignore this email.</p>
      `;
      try {
        await this.sendRaw({ to: email, subject: 'Confirm your new email - Nova Store', html });
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
