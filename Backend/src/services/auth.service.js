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
     const { sub: googleId, email, given_name, family_name, name, picture: avatarUrl } = payload;

     let firstName = given_name;
     let lastName = family_name;

     if (!firstName) {
       if (name) {
         const parts = name.trim().split(/\s+/);
         firstName = parts[0] || 'Google';
         lastName = parts.slice(1).join(' ') || 'User';
       } else {
         const emailPrefix = email ? email.split('@')[0] : 'Google';
         firstName = emailPrefix;
         lastName = 'User';
       }
     }
     if (!lastName) {
       lastName = 'User';
     }

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

        const authTokens = await this.generateTokens(user);
        return { user, tokens: authTokens };
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
         first_name: firstName,
         last_name: lastName,
         password: null // OAuth users don't have a password initially
       });
       
       // Update with Google ID and avatar
       user = await userModel.update(user.id, { 
         google_id: googleId,
         avatar_url: avatarUrl,
         is_email_verified: true // Google emails are pre-verified
       });
     }

     const authTokens = await this.generateTokens(user);
     return { user, tokens: authTokens };
   }

    async generateTokens(user) {
      // Shorter token expiration for admin/staff sessions
      const isAdmin = ['STORE_OWNER', 'MANAGER', 'ORDER_STAFF', 'INVENTORY_STAFF'].includes(user.role);
      const accessTokenExpiresIn = isAdmin ? (securityConfig?.admin?.session?.accessTokenExpiresIn || '15m') : '15m';
      const refreshTokenExpiresIn = isAdmin ? (securityConfig?.admin?.session?.refreshTokenExpiresIn || '8h') : '30d';

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
        const expiry = securityConfig?.admin?.session?.refreshTokenExpiresIn || '8h';
        const hours = parseInt(expiry);
        expiresAt.setHours(expiresAt.getHours() + (isNaN(hours) ? 8 : hours));
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
        const expiry = securityConfig?.admin?.session?.refreshTokenExpiresIn || '8h';
        const hours = parseInt(expiry);
        const redisTTL = isNaN(hours) ? 8 * 60 * 60 : hours * 60 * 60;

        await redisClient.set(sessionKey, JSON.stringify({
          id: sessionKey, // include key for easy deletion
          userId: user.id,
          expiresAt: expiresAt.toISOString()
        }), {
          EX: isAdmin ? redisTTL : 30 * 24 * 60 * 60 // Match Redis expiration (8h vs 30d)
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
       // Audit: unknown email — generic message to caller, specific action in audit trail
       Promise.resolve(AuditService.logRaw('user.login.failed', 'user', null, {
         ip,
         newValues: { reason: 'email_not_found', emailAttempted: email },
       })).catch(() => {});
       const error = new Error('Invalid email or password');
       error.statusCode = 401;
       throw error;
     }

     // Check account status: active, not locked, verified
     if (!user.is_active) {
       Promise.resolve(AuditService.logRaw('user.login.failed', 'user', user.id, {
         ip,
         userId: user.id,
         newValues: { reason: 'account_deactivated' },
       })).catch(() => {});
       const error = new Error('Your account has been deactivated. Please contact support.');
       error.statusCode = 403;
       throw error;
     }

     if (user.is_locked && user.lock_until && new Date(user.lock_until) > new Date()) {
       Promise.resolve(AuditService.logRaw('user.auth.lockout', 'user', user.id, {
         ip,
         userId: user.id,
         newValues: { reason: 'account_locked', lockUntil: user.lock_until },
       })).catch(() => {});
       const error = new Error('Account is locked due to multiple failed login attempts. Try again later.');
       error.statusCode = 403;
       throw error;
     }

     if (!user.is_email_verified) {
       Promise.resolve(AuditService.logRaw('user.login.failed', 'user', user.id, {
         ip,
         userId: user.id,
         newValues: { reason: 'email_not_verified' },
       })).catch(() => {});
       const error = new Error('Please verify your email address before logging in.');
       error.statusCode = 403;
       throw error;
     }

     const isMatch = await userModel.comparePassword(password, user.password_hash);
     if (!isMatch) {
       await userModel.incrementFailedAttempts(user);
       logger.warn(`Failed login attempt for email: ${email}`);
       Promise.resolve(AuditService.logRaw('user.login.failed', 'user', user.id, {
         ip,
         userId: user.id,
         newValues: { reason: 'bad_password', failedAttempts: (user.failed_login_attempts || 0) + 1 },
       })).catch(() => {});
       const error = new Error('Invalid email or password');
       error.statusCode = 401;
       throw error;
     }

     // Reset failed attempts on success
     if (user.failed_login_attempts > 0 || ip) {
       await userModel.resetFailedAttempts(user, ip);
     }

     logger.info(`User logged in successfully: ${email}`);
     Promise.resolve(AuditService.logRaw('user.login.success', 'user', user.id, {
       ip,
       userId: user.id,
     })).catch(() => {});
     const tokens = await this.generateTokens(user);
     return { user, tokens };
   }

    async adminLogin(email, password, ip = null) {
      // Multi-admin login: query users table (no hardcoded single-email restriction)
      const user = await userModel.findByEmail(email);

      if (!user) {
        logger.warn(`Admin login attempt for non-existent email: ${email}`);
        Promise.resolve(AuditService.logRaw('admin.login.failed', 'user', null, {
          ip,
          newValues: { reason: 'email_not_found', emailAttempted: email },
        })).catch(() => {});
        const error = new Error('Invalid email or password');
        error.statusCode = 401;
        throw error;
      }

      // Must hold at least one admin-grade role in user_roles
      const { roles } = await userModel.getUserRolesAndPermissions(user.id);
      const ADMIN_ROLES = ['ORDER_STAFF', 'INVENTORY_STAFF', 'MANAGER', 'STORE_OWNER'];
      const hasAdminRole = roles.some(r => ADMIN_ROLES.includes(r));

      if (!hasAdminRole) {
        logger.warn(`Non-admin user attempted admin login: ${email}`);
        Promise.resolve(AuditService.logRaw('admin.login.failed', 'user', user.id, {
          ip,
          userId: user.id,
          newValues: { reason: 'insufficient_role', emailAttempted: email },
        })).catch(() => {});
        const error = new Error('Invalid email or password');
        error.statusCode = 401;
        throw error;
      }

      // Account status checks
      if (!user.is_active) {
        Promise.resolve(AuditService.logRaw('admin.login.failed', 'user', user.id, {
          ip,
          userId: user.id,
          newValues: { reason: 'account_deactivated' },
        })).catch(() => {});
        const error = new Error('Your account has been deactivated. Please contact support.');
        error.statusCode = 403;
        throw error;
      }

      if (user.is_locked && user.lock_until && new Date(user.lock_until) > new Date()) {
        Promise.resolve(AuditService.logRaw('admin.auth.lockout', 'user', user.id, {
          ip,
          userId: user.id,
          newValues: { reason: 'account_locked', lockUntil: user.lock_until },
        })).catch(() => {});
        const error = new Error('Admin account is locked due to multiple failed login attempts. Try again later.');
        error.statusCode = 403;
        throw error;
      }

      if (!user.password_hash) {
        Promise.resolve(AuditService.logRaw('admin.login.failed', 'user', user.id, {
          ip,
          userId: user.id,
          newValues: { reason: 'no_password_set' },
        })).catch(() => {});
        const error = new Error('Password not set. Please complete your invitation setup.');
        error.statusCode = 401;
        throw error;
      }

      const isMatch = await userModel.comparePassword(password, user.password_hash);
      if (!isMatch) {
        await userModel.incrementAdminFailedAttempts(user);
        logger.warn(`Failed admin login attempt for email: ${email}`);
        Promise.resolve(AuditService.logRaw('admin.login.failed', 'user', user.id, {
          ip,
          userId: user.id,
          newValues: { reason: 'bad_password', failedAttempts: (user.failed_login_attempts || 0) + 1 },
        })).catch(() => {});
        const error = new Error('Invalid email or password');
        error.statusCode = 401;
        throw error;
      }

      // Reset failed attempts on success
      if (user.failed_login_attempts > 0 || ip) {
        await userModel.resetFailedAttempts(user, ip);
      }

      logger.info(`Admin logged in successfully: ${email}`);
      Promise.resolve(AuditService.logRaw('admin.login.success', 'user', user.id, {
        ip,
        userId: user.id,
      })).catch(() => {});

      // Set role on user object so generateTokens uses correct session config
      const roleHierarchy = ['ORDER_STAFF', 'INVENTORY_STAFF', 'MANAGER', 'STORE_OWNER'];
      const primaryRole = roleHierarchy.findLast(r => roles.includes(r));
      user.role = primaryRole || roles[0] || 'ORDER_STAFF';

      const authTokens = await this.generateTokens(user);
      return { user, tokens: authTokens };
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

    async setPassword(userId, newPassword) {
      const user = await userModel.findById(userId);
      if (!user) {
        const error = new Error('User not found');
        error.statusCode = 404;
        throw error;
      }

      if (user.password_hash) {
        const error = new Error('Password has already been set for this account. Please use the change password endpoint instead.');
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

    getFacebookAuthUrl() {
      const state = crypto.randomBytes(32).toString('hex');
      const params = new URLSearchParams({
        client_id: process.env.FACEBOOK_CLIENT_ID,
        redirect_uri: process.env.FACEBOOK_REDIRECT_URI,
        scope: 'email,public_profile',
        state: state,
        response_type: 'code'
      });
      const url = `https://www.facebook.com/v19.0/dialog/oauth?${params.toString()}`;
      return { url, state };
    }

    async facebookLogin(code) {
      const tokenParams = new URLSearchParams({
        client_id: process.env.FACEBOOK_CLIENT_ID,
        client_secret: process.env.FACEBOOK_CLIENT_SECRET,
        redirect_uri: process.env.FACEBOOK_REDIRECT_URI,
        code: code
      });

      const tokenResponse = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token?${tokenParams.toString()}`);
      if (!tokenResponse.ok) {
        const errData = await tokenResponse.json();
        throw new Error(errData.error?.message || 'Failed to obtain Facebook access token');
      }
      const { access_token } = await tokenResponse.json();

      const profileResponse = await fetch(
        `https://graph.facebook.com/me?fields=id,email,first_name,last_name,picture&access_token=${access_token}`
      );
      if (!profileResponse.ok) {
        throw new Error('Failed to fetch Facebook profile information');
      }
      const profile = await profileResponse.json();
      const { id: facebookId, email, first_name, last_name, picture } = profile;

      const avatarUrl = picture?.data?.url || null;
      const firstName = first_name || 'Facebook';
      const lastName = last_name || 'User';

      let user = await userModel.findByFacebookId(facebookId);

      if (user) {
        if (!user.is_active) {
          const error = new Error('Your account has been deactivated. Please contact support.');
          error.statusCode = 403;
          throw error;
        }
        const authTokens = await this.generateTokens(user);
        return { user, tokens: authTokens };
      }

      user = await userModel.findByEmail(email);

      if (user) {
        user = await userModel.update(user.id, {
          facebook_id: facebookId,
          avatar_url: avatarUrl || user.avatar_url
        });
      } else {
        user = await userModel.create({
          email,
          first_name: firstName,
          last_name: lastName,
          password: null,
          facebook_id: facebookId,
          avatar_url: avatarUrl,
          is_email_verified: true
        });
      }

      const authTokens = await this.generateTokens(user);
      return { user, tokens: authTokens };
    }

    getAppleAuthUrl() {
      const state = crypto.randomBytes(32).toString('hex');
      const params = new URLSearchParams({
        client_id: process.env.APPLE_CLIENT_ID,
        redirect_uri: process.env.APPLE_REDIRECT_URI,
        response_type: 'code id_token',
        response_mode: 'form_post',
        scope: 'name email',
        state: state
      });
      const url = `https://appleid.apple.com/auth/authorize?${params.toString()}`;
      return { url, state };
    }

    async generateAppleClientSecret() {
      const privateKey = process.env.APPLE_PRIVATE_KEY;
      if (!privateKey) {
        throw new Error('APPLE_PRIVATE_KEY is not configured');
      }

      const time = Math.floor(Date.now() / 1000);
      const payload = {
        iss: process.env.APPLE_TEAM_ID,
        iat: time,
        exp: time + (180 * 24 * 60 * 60),
        aud: 'https://appleid.apple.com',
        sub: process.env.APPLE_CLIENT_ID
      };

      return jwt.sign(payload, privateKey, {
        algorithm: 'ES256',
        header: {
          kid: process.env.APPLE_KEY_ID
        }
      });
    }

    async verifyAppleIdToken(idToken) {
      const decodedHeader = jwt.decode(idToken, { complete: true })?.header;
      if (!decodedHeader || !decodedHeader.kid) {
        throw new Error('Invalid Apple ID token header');
      }

      const response = await fetch('https://appleid.apple.com/auth/keys');
      if (!response.ok) {
        throw new Error('Failed to fetch Apple public keys');
      }
      const jwks = await response.json();
      const jwk = jwks.keys.find(k => k.kid === decodedHeader.kid);
      if (!jwk) {
        throw new Error('Matching Apple public key not found');
      }

      const publicKey = crypto.createPublicKey({ key: jwk, format: 'jwk' });

      return jwt.verify(idToken, publicKey, {
        algorithms: ['RS256'],
        audience: process.env.APPLE_CLIENT_ID,
        issuer: 'https://appleid.apple.com'
      });
    }

    async appleLogin(code, idToken, userPayload) {
      const verifiedPayload = await this.verifyAppleIdToken(idToken);
      const appleId = verifiedPayload.sub;
      const email = verifiedPayload.email;

      let firstName = 'Apple';
      let lastName = 'User';

      if (userPayload) {
        try {
          const parsedUser = typeof userPayload === 'string' ? JSON.parse(userPayload) : userPayload;
          if (parsedUser.name) {
            firstName = parsedUser.name.firstName || firstName;
            lastName = parsedUser.name.lastName || lastName;
          }
        } catch (e) {
          logger.error('Failed to parse Apple user payload:', e);
        }
      } else if (email) {
        firstName = email.split('@')[0] || firstName;
      }

      let user = await userModel.findByAppleId(appleId);

      if (user) {
        if (!user.is_active) {
          const error = new Error('Your account has been deactivated. Please contact support.');
          error.statusCode = 403;
          throw error;
        }
        const authTokens = await this.generateTokens(user);
        return { user, tokens: authTokens };
      }

      user = await userModel.findByEmail(email);

      if (user) {
        user = await userModel.update(user.id, {
          apple_id: appleId,
          is_email_verified: true
        });
      } else {
        user = await userModel.create({
          email,
          first_name: firstName,
          last_name: lastName,
          password: null,
          apple_id: appleId,
          is_email_verified: true
        });
      }

      const authTokens = await this.generateTokens(user);
      return { user, tokens: authTokens };
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

}

module.exports = new AuthService();

