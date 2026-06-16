const supabase = require('../config/supabase');
const userModel = require('../models/user.model');
const sharp = require('sharp');
const crypto = require('crypto');
const emailService = require('./email.service');
const logger = require('../utils/logger');

class UserService {
   async getProfile(userId) {
     const user = await userModel.findById(userId);
     if (!user) {
       const error = new Error('User not found');
       error.statusCode = 404;
       throw error;
     }
     
     // Remove sensitive data
     const { password_hash, deleted_at, google_id, apple_id, facebook_id, failed_login_attempts, lock_until, ...profile } = user;
     return profile;
   }

  async updateProfile(userId, updateData) {
    // Only allow specific fields
    const allowedFields = ['first_name', 'last_name', 'phone_number', 'date_of_birth', 'bio', 'preferences'];
    const filteredData = Object.keys(updateData)
      .filter(key => allowedFields.includes(key))
      .reduce((obj, key) => {
        obj[key] = updateData[key];
        return obj;
      }, {});

    const user = await userModel.update(userId, filteredData);
    logger.info(`User profile updated for id: ${userId}`);
    return user;
  }

  async uploadAvatar(userId, file) {
    const user = await userModel.findById(userId);
    if (!user) throw new Error('User not found');

    // Process image with sharp: resize and convert to webp
    const processedBuffer = await sharp(file.buffer)
      .resize(500, 500, { fit: 'cover' })
      .webp({ quality: 80 })
      .toBuffer();

    const fileName = `${userId}-${Date.now()}.webp`;
    const filePath = `avatars/${fileName}`;

    // 1. Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('nova-store')
      .upload(filePath, processedBuffer, {
        contentType: 'image/webp',
        upsert: true
      });

    if (error) throw error;

    // 2. Get Public URL
    const { data: { publicUrl } } = supabase.storage
      .from('nova-store')
      .getPublicUrl(filePath);

    // 3. Delete old avatar if exists
    if (user.avatar_url) {
      try {
        const oldPath = user.avatar_url.split('/').slice(-2).join('/'); // avatars/filename.jpg
        await supabase.storage.from('nova-store').remove([oldPath]);
      } catch (err) {
        logger.error(`Failed to delete old avatar: ${err.message}`);
      }
    }

    // 4. Update user record
    await userModel.update(userId, { avatar_url: publicUrl });
    
    logger.info(`Avatar updated for user: ${userId}`);
    return publicUrl;
  }

  async deleteAvatar(userId) {
    const user = await userModel.findById(userId);
    if (!user || !user.avatar_url) return;

    const oldPath = user.avatar_url.split('/').slice(-2).join('/');
    await supabase.storage.from('nova-store').remove([oldPath]);
    
    await userModel.update(userId, { avatar_url: null });
    logger.info(`Avatar deleted for user: ${userId}`);
  }

  async requestEmailChange(userId, newEmail) {
    const user = await userModel.findById(userId);
    if (!user) throw new Error('User not found');

    const existingUser = await userModel.findByEmail(newEmail);
    if (existingUser) {
      const error = new Error('Email already in use');
      error.statusCode = 400;
      throw error;
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours

    // We'll store the new email in a JSON field in the token table or just handle it via the service
    // For simplicity, we'll assume the verification_tokens table can store the 'metadata' (the new email)
    // But since our schema doesn't have metadata, let's just use the 'token' to verify and then the user provides the new email again, 
    // OR we update the token model.
    
    // Better: Add a column for 'new_email' in verification_tokens or create a specific table.
    // I'll stick to a simpler approach: the token is linked to the user, and the verify endpoint receives the new email.
    
    await tokenModel.createVerificationToken(userId, hashedToken, expiresAt.toISOString());
    
    // We need a specific email template for "Confirm your NEW email"
    await emailService.sendEmailChangeVerification(newEmail, user.first_name, rawToken);
    
    logger.info(`Email change verification sent to ${newEmail} for user ${userId}`);
    return true;
  }

  async verifyEmailChange(userId, token, newEmail) {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const tokenData = await tokenModel.findVerificationToken(hashedToken);

    if (!tokenData || tokenData.user_id !== userId || tokenData.used || new Date(tokenData.expires_at) < new Date()) {
      const error = new Error('Invalid or expired verification token');
      error.statusCode = 400;
      throw error;
    }

    // Check one last time if email is taken
    const existingUser = await userModel.findByEmail(newEmail);
    if (existingUser) {
      const error = new Error('Email already in use');
      error.statusCode = 400;
      throw error;
    }

    await userModel.update(userId, { email: newEmail, is_email_verified: true });
    await tokenModel.markVerificationTokenAsUsed(tokenData.id);
    
    logger.info(`Email successfully changed to ${newEmail} for user ${userId}`);
    return true;
  }

  async deleteAccount(userId) {
    // Soft delete / anonymize user
    const updates = {
      email: `deleted_${userId}@novastore.com`,
      first_name: 'Deleted',
      last_name: 'User',
      is_active: false,
      google_id: null,
      apple_id: null,
      facebook_id: null
    };
    
    await userModel.update(userId, updates);

    // 2. Anonymize PII in related order records
    const { error: orderError } = await supabase
      .from('orders')
      .update({
        customer_email: `deleted_${userId}@novastore.com`,
        customer_phone: 'Anonymized',
        shipping_address: { address_line_1: 'Anonymized', city: 'Anonymized', state: 'Anonymized', country: 'Anonymized', postal_code: '0000' }
      })
      .eq('user_id', userId);

    if (orderError) {
      logger.error(`[GDPR Cleanup] Failed to anonymize orders for user ${userId}: ${orderError.message}`);
    }

    // 3. Purge notifications and settings
    const { error: notifError } = await supabase
      .from('notifications')
      .delete()
      .eq('user_id', userId);

    if (notifError) {
      logger.error(`[GDPR Cleanup] Failed to delete notifications for user ${userId}: ${notifError.message}`);
    }

    const { error: settingsError } = await supabase
      .from('notification_settings')
      .delete()
      .eq('user_id', userId);

    if (settingsError) {
      logger.error(`[GDPR Cleanup] Failed to delete notification settings for user ${userId}: ${settingsError.message}`);
    }
    
    logger.info(`User account soft-deleted and PII anonymized: ${userId}`);
    return true;
  }
}

module.exports = new UserService();
