const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const userModel = require('../models/user.model');
const sessionModel = require('../models/session.model');
const tokenModel = require('../models/token.model');
const emailService = require('./email.service');
const NotificationService = require('./notification.service');
const AuditService = require('./audit.service');
const logger = require('../utils/logger');
const RegistrationService = require('./registration.service');
const RoleModel = require('../models/role.model');
const UserRoleModel = require('../models/user-role.model');
const securityConfig = require('../config/security');

const { OAuth2Client } = require('google-auth-library');
const { redisClient } = require('../config/redis');

const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

class AuthService {
   getGoogleAuthUrl() {
     const state = crypto.randomBytes(32).toString('hex');
     const url = googleClient.generateAuthUrl({
       access_type: 'offline',
       scope: ['profile', 'email'],
       prompt: 'consent',
       state: state
     });
     return { url, state };
   }

   async googleLogin(code) {
     const { tokens } = await googleClient.getToken(code);
     googleClient.setCredentials(tokens);

     const ticket = await googleClient.verifyIdToken({
       idToken: tokens.id_token,
       audience: process.env.GOOGLE_CLIENT_ID
     });

     const payload = ticket.getPayload();
     const { sub: googleId, email, given_name: firstName, family_name: lastName, picture: avatarUrl } = payload;

      let user = await userModel.findByGoogleId(googleId);

      if (user) {
        // Existing OAuth user
        // Check account status: active, not locked, verified
        if (!user.is_active) {
          const error = new Error('Your account has been deactivated. Please contact support.');
          error.statusCode = 403;
          throw error;
        }

        if (user.is_locked && user.lock_until && new Date(user.lock_until) > new Date()) {
          const error = new Error('Account is locked due to multiple failed login attempts. Try again later.');
          error.statusCode = 403;
          throw error;
        }

        if (!user.is_email_verified) {
          const error = new Error('Please verify your email address before logging in.');
          error.statusCode = 403;
          throw error;
        }

        return await this.generateTokens(user);
      }

     // Check if email exists for account linking
     user = await userModel.findByEmail(email);

     if (user) {
       // Link Google ID to existing email account
       user = await userModel.update(user.id, { 
         google_id: googleId,
         avatar_url: avatarUrl || user.avatar_url
       });
     } else {
       // Create new user from Google data
       user = await userModel.create({
         email,
         firstName,
         lastName,
         password: null // OAuth users don't have a password initially
       });
       
       // Update with Google ID and avatar
       user = await userModel.update(user.id, { 
         google_id: googleId,
         avatar_url: avatarUrl,
         is_email_verified: true // Google emails are pre-verified
       });
     }

     return await this.generateTokens(user);
   }

    async generateTokens(user) {
      // Shorter token expiration for admin sessions
      const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
      const accessTokenExpiresIn = isAdmin ? '15m' : '15m'; // Could be made shorter for admins if needed
      const refreshTokenExpiresIn = isAdmin ? '8h' : '30d'; // Shorter refresh token for admins (8 hours vs 30 days)

      const accessToken = jwt.sign(
        { id: user.id, role: user.role },
        process.env.JWT_ACCESS_SECRET,
        { expiresIn: accessTokenExpiresIn }
      );

      const refreshToken = jwt.sign(
        { id: user.id },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: refreshTokenExpiresIn }
      );

      // Store hashed refresh token in DB for security
      const hashedRT = crypto.createHash('sha256').update(refreshToken).digest('hex');
      const expiresAt = new Date();
      if (isAdmin) {
        expiresAt.setHours(expiresAt.getHours() + 8);
      } else {
        expiresAt.setDate(expiresAt.getDate() + 30);
      }

      if (isAdmin) {
        // Enforce concurrent admin session cap
        const activeCount = await sessionModel.countActiveAdminSessions(user.id);
        if (activeCount >= 3) {
          const revokedSession = await sessionModel.revokeOldestAdminSession(user.id);
          if (revokedSession && redisClient.isOpen) {
            const sessionKey = `session:${revokedSession.refresh_token}`;
            await redisClient.del(sessionKey);
            await redisClient.sRem(`user:sessions:${user.id}`, sessionKey);
          }
        }
      }
      
      await sessionModel.create(user.id, hashedRT, expiresAt.toISOString(), isAdmin);
      
      // Also store in Redis for high-performance lookup
      if (redisClient.isOpen) {
        const sessionKey = `session:${hashedRT}`;
        await redisClient.set(sessionKey, JSON.stringify({
          id: sessionKey, // include key for easy deletion
          userId: user.id,
          expiresAt: expiresAt.toISOString()
        }), {
          EX: isAdmin ? 8 * 60 * 60 : 30 * 24 * 60 * 60 // Match Redis expiration (8h vs 30d)
        });

        // Add to user's active sessions set
        await redisClient.sAdd(`user:sessions:${user.id}`, sessionKey);
      }

      return { accessToken, refreshToken };
    }

   async register(userData) {
     // Delegate to RegistrationService
     return await RegistrationService.register(userData);
   }

   async login(email, password, ip = null) {
     const user = await userModel.findByEmail(email);
     if (!user) {
       const error = new Error('Invalid email or password');
       error.statusCode = 401;
       throw error;
     }

     // Check account status: active, not locked, verified
     if (!user.is_active) {
       const error = new Error('Your account has been deactivated. Please contact support.');
       error.statusCode = 403;
       throw error;
     }

     if (user.is_locked && user.lock_until && new Date(user.lock_until) > new Date()) {
       const error = new Error('Account is locked due to multiple failed login attempts. Try again later.');
       error.statusCode = 403;
       throw error;
     }

     if (!user.is_email_verified) {
       const error = new Error('Please verify your email address before logging in.');
       error.statusCode = 403;
       throw error;
     }

     const isMatch = await userModel.comparePassword(password, user.password_hash);
     if (!isMatch) {
       await userModel.incrementFailedAttempts(user);
       logger.warn(`Failed login attempt for email: ${email}`);
       // Audit log (requires req if we pass it, but we don't have req here unless we do it in controller)
       // Since we don't have req object directly in service right now, we can omit it, or we can just log a basic audit
       // We will skip AuditService here since it relies on req.user and req.ip being cleanly passed, and we just added last_login_ip support in userModel.
       const error = new Error('Invalid email or password');
       error.statusCode = 401;
       throw error;
     }

     // Reset failed attempts on success
     if (user.failed_login_attempts > 0 || ip) {
       await userModel.resetFailedAttempts(user, ip);
     }

     logger.info(`User logged in successfully: ${email}`);
     const tokens = await this.generateTokens(user);
     return { user, tokens };
   }

    async adminLogin(email, password, ip = null) {
      // Check if email is exactly the predefined admin email
      if (email !== 'admin@novastore.com') {
        // Log failed attempt for non-admin email trying to login as admin
        logger.warn(`Non-admin email attempted to login as admin: ${email}`);
        const error = new Error('Invalid email or password');
        error.statusCode = 401;
        throw error;
      }

      const user = await userModel.findByEmail(email);
      if (!user) {
        // Log failed attempt for non-existent email (security through obscurity)
        logger.warn(`Admin login attempt for non-existent email: ${email}`);
        const error = new Error('Invalid email or password');
        error.statusCode = 401;
        throw error;
      }

      // Check user role first to reject customers trying to log in as admin
      if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
        logger.warn(`Non-admin attempted to login to admin portal: ${email}`);
        const error = new Error('Not authorized as admin');
        error.statusCode = 403;
        throw error;
      }

      // Check account status: active, not locked, verified
      if (!user.is_active) {
        const error = new Error('Your account has been deactivated. Please contact support.');
        error.statusCode = 403;
        throw error;
      }

      // Check admin/shared lockout using standard lock_until column
      if (user.lock_until && new Date(user.lock_until) > new Date()) {
        const error = new Error('Admin account is locked due to multiple failed login attempts. Try again later.');
        error.statusCode = 403;
        throw error;
      }

      if (!user.is_email_verified) {
        const error = new Error('Please verify your email address before logging in.');
        error.statusCode = 403;
        throw error;
      }

      const isMatch = await userModel.comparePassword(password, user.password_hash);
      if (!isMatch) {
        // Increment admin failed attempts (locks for 60 min after 3 attempts)
        await userModel.incrementAdminFailedAttempts(user);
        logger.warn(`Failed admin login attempt for email: ${email}`);
        const error = new Error('Invalid email or password');
        error.statusCode = 401;
        throw error;
      }

      // Reset attempts on success
      if (user.failed_login_attempts > 0 || ip) {
        await userModel.resetFailedAttempts(user, ip);
      }

      logger.info(`Admin logged in successfully: ${email}`);
      const tokens = await this.generateTokens(user);
      return { user, tokens };
    }

   async refreshAccessToken(refreshToken) {
     if (!refreshToken) {
       const error = new Error('Refresh token is required');
       error.statusCode = 401;
       throw error;
     }
     // Hash incoming refresh token to find it in DB
     const hashedRT = crypto.createHash('sha256').update(refreshToken).digest('hex');
     
     let session = null;
     
      // Try Redis first
      if (redisClient.isOpen) {
        const cachedSession = await redisClient.get(`session:${hashedRT}`);
        if (cachedSession) {
          session = JSON.parse(cachedSession);
          // Validate that the session belongs to the expected user (will be checked after JWT verification)
        }
      }
 
     // Fallback to DB
     if (!session) {
       session = await sessionModel.findByToken(hashedRT);
     }
     
     if (!session || session.revoked || new Date(session.expires_at) < new Date()) {
       const error = new Error('Invalid or expired refresh token');
       error.statusCode = 401;
       throw error;
     }
 
     try {
       const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
       const user = await userModel.findById(decoded.id);
 
       if (!user || !user.is_active) {
         throw new Error('User not found or inactive');
       }
 
       // Revoke old session and rotate
       await sessionModel.revoke(hashedRT);
       return await this.generateTokens(user);
     } catch (err) {
       const error = new Error('Invalid refresh token');
       error.statusCode = 401;
       throw error;
     }
   }

   async logout(refreshToken) {
     if (!refreshToken) return; // Already logged out or no session
     const hashedRT = crypto.createHash('sha256').update(refreshToken).digest('hex');
     await sessionModel.revoke(hashedRT);
     
     // Clear Redis
     if (redisClient.isOpen) {
       const sessionKey = `session:${hashedRT}`;
       const cached = await redisClient.get(sessionKey);
       if (cached) {
         const { userId } = JSON.parse(cached);
         await redisClient.del(sessionKey);
         await redisClient.sRem(`user:sessions:${userId}`, sessionKey);
       }
     }
 
     logger.info(`User logged out and session revoked`);
   }

   async changePassword(userId, currentPassword, newPassword) {
     const user = await userModel.findById(userId);
     if (!user) {
       const error = new Error('User not found');
       error.statusCode = 404;
       throw error;
     }

     const isMatch = await userModel.comparePassword(currentPassword, user.password_hash);
     if (!isMatch) {
       const error = new Error('Incorrect current password');
       error.statusCode = 400;
       throw error;
     }

     const salt = await bcrypt.genSalt(12);
     const hashedPassword = await bcrypt.hash(newPassword, salt);
     await userModel.update(userId, { password_hash: hashedPassword });
     
     // Invalidate all sessions on password change
     await sessionModel.revokeAllForUser(userId);
     if (redisClient.isOpen) {
       const userSessionsSet = `user:sessions:${userId}`;
       const sessionKeys = await redisClient.sMembers(userSessionsSet);
       if (sessionKeys.length > 0) {
         await redisClient.del(sessionKeys);
         await redisClient.del(userSessionsSet);
       }
     }
   }

   async initiatePasswordReset(email) {
     const user = await userModel.findByEmail(email);
     if (!user) {
       const error = new Error('No account found with this email address');
       error.statusCode = 404;
       throw error;
     }

     const rawToken = crypto.randomBytes(32).toString('hex');
     const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
     
     const expiresAt = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 hour
     await tokenModel.createPasswordResetToken(user.id, hashedToken, expiresAt.toISOString());
     
     // Send password reset via notification service (email + inapp)
     await NotificationService.sendPasswordReset(user.id, rawToken);
   }

   async resetPassword(token, newPassword) {
     if (!token) {
       const error = new Error('Reset token is required');
       error.statusCode = 400;
       throw error;
     }
     const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
     const tokenData = await tokenModel.findPasswordResetToken(hashedToken);
     
     if (!tokenData || tokenData.used || new Date(tokenData.expires_at) < new Date()) {
       const error = new Error('Invalid or expired reset token');
       error.statusCode = 400;
       throw error;
     }

     const salt = await bcrypt.genSalt(12);
     const hashedPassword = await bcrypt.hash(newPassword, salt);
     
     // Update password and mark token used
     await userModel.update(tokenData.user_id, { password_hash: hashedPassword });
     await tokenModel.markPasswordResetTokenAsUsed(tokenData.id);
     
     logger.info(`Password reset successful for user_id: ${tokenData.user_id}`);
     
     // IMPORTANT: Invalidate all existing sessions (force re-login everywhere)
     await sessionModel.revokeAllForUser(tokenData.user_id);
     if (redisClient.isOpen) {
       const userSessionsSet = `user:sessions:${tokenData.user_id}`;
       const sessionKeys = await redisClient.sMembers(userSessionsSet);
       if (sessionKeys.length > 0) {
         await redisClient.del(sessionKeys);
         await redisClient.del(userSessionsSet);
       }
     }
   }

   async verifyEmail(token) {
     if (!token) {
       const error = new Error('Verification token is required');
       error.statusCode = 400;
       throw error;
     }
     const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
     const tokenData = await tokenModel.findVerificationToken(hashedToken);
     
     if (!tokenData || tokenData.used || new Date(tokenData.expires_at) < new Date()) {
       const error = new Error('Invalid or expired verification token');
       error.statusCode = 400;
       throw error;
     }
     
     await userModel.update(tokenData.user_id, { is_email_verified: true });
     await tokenModel.markVerificationTokenAsUsed(tokenData.id);
     logger.info(`Email verified for user_id: ${tokenData.user_id}`);
   }

   async resendVerification(email) {
     const user = await userModel.findByEmail(email);
     if (!user) {
       const error = new Error('No account found with this email address');
       error.statusCode = 404;
       throw error;
     }
     
     if (user.is_email_verified) {
       const error = new Error('Email is already verified');
       error.statusCode = 400;
       throw error;
     }
     
     const rawToken = crypto.randomBytes(32).toString('hex');
     const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
     const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
     
     await tokenModel.createVerificationToken(user.id, hashedToken, expiresAt.toISOString());
     await emailService.sendVerificationEmail(user.email, user.first_name, rawToken);
     
     logger.info(`Verification email resent to: ${email}`);
   }

   async getOAuthStatus(userId) {
     const user = await userModel.findById(userId);
     if (!user) {
       const error = new Error('User not found');
       error.statusCode = 404;
       throw error;
     }
     
     return {
       google: !!user.google_id,
       apple: !!user.apple_id,
       facebook: !!user.facebook_id
     };
   }

    // Admin Methods
    async listUsers(page = 1, limit = 10) {
      return await userModel.findAll(page, limit);
    }
    
    async updateUserStatus(userId, updates) {
      const user = await userModel.update(userId, updates);
      logger.info(`Admin updated status for user ${userId}: ${JSON.stringify(updates)}`);
      return user;
    }

    async adminRegister(userData, createdByUserId = null) {
      // Check if any admin already exists in the system
      const adminExists = await userModel.findAdminExists();
      if (adminExists) {
        const error = new Error('Admin registration is closed. An admin account already exists.');
        error.statusCode = 403;
        throw error;
      }

      // Set role to ADMIN for admin registration
      const adminUserData = {
        ...userData,
        role: 'ADMIN'
      };
      
      // Delegate to RegistrationService to handle hashing, validation, etc.
      const user = await RegistrationService.register(adminUserData);
      
      // Assign ADMIN role explicitly via user-role model
      const adminRole = await RoleModel.findByName('ADMIN');
      if (adminRole) {
        await UserRoleModel.assignRole(user.id, adminRole.id, createdByUserId);
      }

      // Update users table with admin properties
      // Note: We remove is_email_verified: true so that standard verification flows are enforced.
      await userModel.update(user.id, {
        role: 'ADMIN',
        department: userData.department,
        access_level: userData.accessLevel || 'admin'
      });
      
      return user;
    }
}

module.exports = new AuthService();

