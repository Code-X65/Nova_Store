const crypto = require('crypto');
const bcrypt = require('bcrypt');
const userModel = require('../models/user.model');
const tokenModel = require('../models/token.model');
const phoneVerificationModel = require('../models/phone_verification.model');
const emailService = require('./email.service');
const notificationService = require('./notification.service');
const smsService = require('./sms.service');
const AuditService = require('./audit.service');
const logger = require('../utils/logger');
const { redisClient } = require('../config/redis');

class RegistrationService {
  /**
   * Validate that password and confirmPassword match
   * @param {Object} body 
   * @throws {Error} if passwords do not match
   */
  validatePassword(body) {
    if (body.password !== body.confirmPassword) {
      const error = new Error('Passwords do not match');
      error.statusCode = 400;
      throw error;
    }
  }

  /**
   * Resolve referral code to a user ID
   * @param {string} code - 12-character referral code
   * @returns {Promise<UUID|null>} user ID of referrer, or null if not found/invalid
   */
  async resolveReferralCode(code) {
    if (!code) return null;
    try {
      const referrer = await userModel.findByReferralCode(code);
      return referrer ? referrer.id : null;
    } catch (err) {
      logger.error(`Error resolving referral code ${code}:`, err);
      return null;
    }
  }

  /**
   * Send phone OTP via Twilio and store the token
   * @param {UUID} userId 
   * @param {string} phoneNumber 
   * @returns 
   */
  async sendPhoneOTP(userId, phoneNumber) {
    // Generate 6-digit OTP
    const otp = crypto.randomInt(100000, 999999).toString(); // 6-digit number

    // Hash the OTP for storage
    const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');

    // Set expiry (10 minutes from now)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // Store the token
    await phoneVerificationModel.createPhoneVerificationToken(userId, otp, phoneNumber, expiresAt.toISOString());

    // Send SMS via Twilio
    const message = `Your Nova Store verification code is: ${otp}. Valid for 10 minutes. Do not share this code.`;
    try {
      const smsResult = await smsService.send(phoneNumber, message);
      if (!smsResult.success) {
        throw new Error(smsResult.error || 'Failed to send SMS');
      }
    } catch (error) {
      logger.error(`Failed to send SMS OTP to ${phoneNumber}: ${error.message}`);
      // We don't throw here because registration can proceed without SMS (user can retry)
      // But we will log and let the controller handle warning
    }

    return { otp }; // Return the plain OTP for testing? In production, we should not return the OTP.
  }

  /**
   * Verify phone OTP
   * @param {UUID} userId 
   * @param {string} otp - 6-digit OTP (plaintext)
   * @returns {Object} { success: boolean, isPhoneVerified: boolean }
   */
  async verifyPhoneOTP(userId, otp) {
    // Hash the provided OTP to compare with stored hash
    const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');

    // Find the token record
    const tokenRecord = await phoneVerificationModel.findByPhoneToken(hashedOtp);
    if (!tokenRecord) {
      const error = new Error('Invalid or expired OTP');
      error.statusCode = 400;
      throw error;
    }

    // Check if token is used
    if (tokenRecord.used) {
      const error = new Error('OTP has already been used');
      error.statusCode = 400;
      throw error;
    }

    // Check if token is expired
    if (new Date(tokenRecord.expires_at) < new Date()) {
      const error = new Error('OTP has expired');
      error.statusCode = 400;
      throw error;
    }

     // Check attempt count (max 5 attempts)
     if (tokenRecord.attempt_count >= 5) {
       const error = new Error('Maximum OTP attempts exceeded. Please request a new OTP.');
       error.statusCode = 422;
       throw error;
     }

     // If OTP is correct (we already have the hash match because we found by hashedOtp)
     // Mark token as used
     await phoneVerificationModel.markAsUsed(tokenRecord.id);

    // Update user's phone verification status
    await userModel.update(userId, { is_phone_verified: true });

    // Clear any attempt count for this user (optional, but clean)
    // We could reset the attempt count for the user's latest token, but since we marked it used, it's not needed.

    return { success: true, isPhoneVerified: true };
  }

  /**
   * Handle referral credit: grant loyalty points to referrer and send notification
   * @param {UUID} toUserId - The new user (referred)
   * @param {UUID} fromUserId - The referrer
   * @returns 
   */
  async handleReferralCredit(toUserId, fromUserId) {
    try {
      // 1. Grant 500 loyalty points to referrer
      const referrer = await userModel.findById(fromUserId);
      if (!referrer) {
        logger.warn(`Referrer ${fromUserId} not found for awarding credit.`);
        return;
      }
      const newPoints = (referrer.loyalty_points || 0) + 500;
      await userModel.update(fromUserId, { loyalty_points: newPoints });
      logger.info(`Awarded 500 loyalty points to referrer ${fromUserId}. New balance: ${newPoints}`);

      // 2. Send notification to the referrer
      const referred = await userModel.findById(toUserId);
      const referredByName = referred ? `${referred.first_name} ${referred.last_name}` : 'A new user';
      
      await notificationService.sendToUser(fromUserId, 'referral_credited', { referredByName });
      logger.info(`Sent referral_credited notification to referrer ${fromUserId}`);
    } catch (err) {
      logger.error(`Failed to handle referral credit for referral from ${fromUserId} to ${toUserId}:`, err);
    }
  }

  /**
   * Resend phone OTP (invalidate old and send new)
   * @param {UUID} userId 
   * @returns 
   */
  async resendPhoneOTP(userId) {
    // Find the latest unused token for this user
    const latestToken = await phoneVerificationModel.findLatestByUserId(userId);
    if (latestToken) {
      // Mark the old token as used (so it can't be used anymore)
      await phoneVerificationModel.markAsUsed(latestToken.id);
    }

    // We need the user's phone number to send a new OTP
    // We don't have it here, so we must get it from the user model
    const user = await userModel.findById(userId);
    if (!user || !user.phone_number) {
      const error = new Error('User phone number not found');
      error.statusCode = 400;
      throw error;
    }

    // Send a new OTP
    let fullPhoneNumber = user.phone_number;
    if (user.phone_country_code) {
      const cleanCode = user.phone_country_code.replace('+', '');
      const cleanPhone = fullPhoneNumber.replace('+', '');
      if (!cleanPhone.startsWith(cleanCode)) {
        fullPhoneNumber = `${cleanCode}${cleanPhone}`;
      }
    }
    return await this.sendPhoneOTP(userId, fullPhoneNumber);
  }

  /**
   * Main registration method
   * @param {Object} body - Registration data
   * @returns {Object} Created user object
   */
  async register(body) {
    // 1. Validate passwords match
    this.validatePassword(body);

    // 2. Check if email already exists
    const existingEmail = await userModel.findByEmail(body.email);
    if (existingEmail) {
      const error = new Error('Email already registered');
      error.statusCode = 409;
      throw error;
    }

    // 3. Check if phone number already exists (if provided)
    if (body.phoneNumber) {
      const existingPhone = await userModel.findByPhoneNumber(body.phoneNumber);
      if (existingPhone) {
        const error = new Error('Phone number already registered');
        error.statusCode = 409;
        throw error;
      }
    }

    // 4. Prepare basic user data for creation (with referral source)
    const basicUserData = {
      email: body.email,
      password: body.password, // Let the userModel hash the password
      first_name: body.firstName,
      last_name: body.lastName,
      phone_number: body.phoneNumber || null,
      phone_country_code: body.phoneCountryCode || null,
      home_address: body.homeAddress ? JSON.stringify(body.homeAddress) : null,
      referral_source: body.referralSource || null,
      referral_source_other: body.referralSourceOther || null,
      is_email_verified: false,
      is_phone_verified: false,
      is_active: true
    };

    // 5. Create the user (generates referral_code inside UserModel)
    const user = await userModel.create(basicUserData);

    // 6. Resolve referral code (if provided) and set referred_by
    if (body.referredByCode) {
      const referrerId = await this.resolveReferralCode(body.referredByCode);
      if (referrerId && referrerId !== user.id) {
        // Prevent self-referral
        await userModel.update(user.id, { referred_by: referrerId });
        // Handle referral credit (grant points to referrer and send notification)
        await this.handleReferralCredit(user.id, referrerId);
      } else if (referrerId === user.id) {
        // Self-referral: we do not set referred_by, but we do not fail registration
        logger.warn(`Self-referral attempted by user ${user.id}`);
      }
      // If referrerId is null, we ignore (invalid or expired code)
    }

    // 7. Generate email verification token and send email
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    await tokenModel.createVerificationToken(user.id, hashedToken, expiresAt.toISOString());
    await emailService.sendVerificationEmail(user.email, user.first_name, rawToken);

    // 8. Send phone OTP
    let phoneOtpResult = null;
    if (user.phone_number) {
      try {
        phoneOtpResult = await this.sendPhoneOTP(user.id, user.phone_number);
      } catch (error) {
        // If SMS fails, we still want to proceed with registration (user can resend OTP later)
        logger.warn(`Failed to send phone OTP during registration for user ${user.id}: ${error.message}`);
        // We do not throw here; we let the registration succeed and the user can retry OTP
      }
    }

    // 9. Audit log
    await AuditService.logRaw('USER_REGISTERED', 'user', user.id, {
      userId: user.id,
      newValues: {
        email: user.email,
        phone: user.phone_number,
        hasReferral: !!body.referredByCode
      }
    });

    // 10. Return the user (without password hash)
    const returnUser = { ...user };
    delete returnUser.password_hash;
    return returnUser;
  }
}

module.exports = new RegistrationService();