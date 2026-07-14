const authService = require('../services/auth.service');
const registrationService = require('../services/registration.service');
const AuditService = require('../services/audit.service');
const userModel = require('../models/user.model');

class AuthController {
  async register(req, res, next) {
    try {
      const user = await authService.register(req.body);
      res.status(201).json({
        success: true,
        message: 'Registration successful. Please check your email to verify your account and verify your phone number via OTP.',
        // Return userId for frontend to use in OTP verification
        data: { userId: user.id }
      });
    } catch (error) {
      next(error);
    }
  }

  async login(req, res, next) {
    try {
      const { email, password } = req.body;
      const ip = req.ip;
      const { user, tokens } = await authService.login(email, password, ip);
      AuditService.log(req, 'user.login.success', 'user', user.id);

      req.session.regenerate((err) => {
        if (err) return next(err);

        req.session.userId = user.id;
        req.session.role = user.role;

        req.session.save((saveErr) => {
          if (saveErr) return next(saveErr);
          if (res.headersSent) return;

          // Set refresh token in HttpOnly cookie
          res.cookie('refreshToken', tokens.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'Strict',
            maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
          });

          return res.status(200).json({
            success: true,
            message: 'Login successful',
            user: {
              id: user.id,
              email: user.email,
              isVerified: user.is_email_verified,
              isPhoneVerified: user.is_phone_verified
            }
          });
        });
      });
    } catch (error) {
      AuditService.log(req, 'user.login.failed', 'user', null, null, { error: error.message });
      next(error);
    }
  }

  async adminLogin(req, res, next) {
    try {
      const { email, password } = req.body;
      const ip = req.ip;
      const { user, tokens } = await authService.adminLogin(email, password, ip);
      AuditService.log(req, 'user.admin_login.success', 'user', user.id);

      res.cookie('refreshToken', tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Strict',
        maxAge: 30 * 24 * 60 * 60 * 1000
      });

       res.status(200).json({
         success: true,
         message: 'Admin login successful',
         accessToken: tokens.accessToken,
         user: {
           id: user.id,
           email: user.email,
           role: user.role,
           firstName: user.first_name,
           lastName: user.last_name,
           isVerified: user.is_email_verified,
           isPhoneVerified: user.is_phone_verified
         }
       });
    } catch (error) {
      AuditService.log(req, 'user.admin_login.failed', 'user', null, null, { error: error.message });
      next(error);
    }
  }

  async refreshToken(req, res, next) {
    try {
      const { refreshToken } = req.cookies;
      const tokens = await authService.refreshAccessToken(refreshToken);

      res.cookie('refreshToken', tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Strict',
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
      });

      res.status(200).json({
        success: true,
        accessToken: tokens.accessToken
      });
    } catch (error) {
      // Clear cookie if refresh token is invalid/revoked
      res.cookie('refreshToken', 'none', {
        expires: new Date(Date.now() + 5 * 1000),
        httpOnly: true
      });
      next(error);
    }
  }

  async logout(req, res, next) {
    try {
      const { refreshToken } = req.cookies;
      if (refreshToken) {
        await authService.logout(refreshToken);
      }
      const userId = req.user ? req.user.id : null;
      AuditService.log(req, 'user.logout', 'user', userId);
      
      res.cookie('refreshToken', 'none', {
        expires: new Date(Date.now() + 10 * 1000),
        httpOnly: true
      });

      if (req.session) {
        req.session.destroy((err) => {
          if (err) return next(err);
          res.clearCookie('connect.sid', { path: '/' });
          return res.status(200).json({ success: true, message: 'User logged out successfully' });
        });
      } else {
        return res.status(200).json({ success: true, message: 'User logged out successfully' });
      }
    } catch (error) {
      next(error);
    }
  }

  async changePassword(req, res, next) {
    try {
      const { currentPassword, newPassword } = req.body;
      await authService.changePassword(req.user.id, currentPassword, newPassword);
      AuditService.log(req, 'user.password.changed', 'user', req.user.id);
      res.status(200).json({ success: true, message: 'Password changed successfully' });
    } catch (error) {
      next(error);
    }
  }

  async setPassword(req, res, next) {
    try {
      const { password } = req.body;
      await authService.setPassword(req.user.id, password);
      AuditService.log(req, 'user.password.set', 'user', req.user.id);
      res.status(200).json({ success: true, message: 'Password set successfully' });
    } catch (error) {
      next(error);
    }
  }

  async forgotPassword(req, res, next) {
    try {
      await authService.initiatePasswordReset(req.body.email);
      res.status(200).json({ success: true, message: 'Password reset link has been sent to your email address.' });
    } catch (error) {
      next(error);
    }
  }

  async resetPassword(req, res, next) {
    try {
      const { token, newPassword } = req.body;
      await authService.resetPassword(token, newPassword);
      AuditService.log(req, 'user.password.reset', 'user', null);
      res.status(200).json({ success: true, message: 'Password reset successful' });
    } catch (error) {
      next(error);
    }
  }

  async googleLogin(req, res, next) {
    try {
      const { url, state } = authService.getGoogleAuthUrl();
      
      // Set short-lived state cookie for CSRF protection
      res.cookie('oauth_state', state, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Lax',
        maxAge: 15 * 60 * 1000 // 15 minutes
      });

      res.redirect(url);
    } catch (error) {
      next(error);
    }
  }

  async googleCallback(req, res, next) {
    try {
      const { code, state } = req.query;
      const storedState = req.cookies.oauth_state;

      if (!state || !storedState || state !== storedState) {
        const error = new Error('Invalid OAuth state. CSRF protection triggered.');
        error.statusCode = 403;
        throw error;
      }

      // Clear state cookie
      res.clearCookie('oauth_state');

      const { user, tokens } = await authService.googleLogin(code);
      AuditService.log(req, 'user.oauth.google.login', 'user', user.id);

      req.session.regenerate((err) => {
        if (err) return next(err);

        req.session.userId = user.id;
        req.session.role = user.role;

        req.session.save((saveErr) => {
          if (saveErr) return next(saveErr);
          if (res.headersSent) return;

          // Set refresh token in HttpOnly cookie
          res.cookie('refreshToken', tokens.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'Strict',
            maxAge: 30 * 24 * 60 * 60 * 1000
          });

          res.redirect(`${process.env.CLIENT_URL}/oauth-success?isEmailVerified=${user.is_email_verified}&isPhoneVerified=${user.is_phone_verified}`);
        });
      });
    } catch (error) {
      next(error);
    }
  }

  async facebookLogin(req, res, next) {
    try {
      const { url, state } = authService.getFacebookAuthUrl();
      
      res.cookie('oauth_state', state, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Lax',
        maxAge: 15 * 60 * 1000
      });

      res.redirect(url);
    } catch (error) {
      next(error);
    }
  }

  async facebookCallback(req, res, next) {
    try {
      const { code, state } = req.query;
      const storedState = req.cookies.oauth_state;

      if (!state || !storedState || state !== storedState) {
        const error = new Error('Invalid OAuth state. CSRF protection triggered.');
        error.statusCode = 403;
        throw error;
      }

      res.clearCookie('oauth_state');

      const { user, tokens } = await authService.facebookLogin(code);
      AuditService.log(req, 'user.oauth.facebook.login', 'user', user.id);
      
      req.session.regenerate((err) => {
        if (err) return next(err);

        req.session.userId = user.id;
        req.session.role = user.role;

        req.session.save((saveErr) => {
          if (saveErr) return next(saveErr);
          if (res.headersSent) return;

          res.cookie('refreshToken', tokens.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'Strict',
            maxAge: 30 * 24 * 60 * 60 * 1000
          });

          res.redirect(`${process.env.CLIENT_URL}/oauth-success?isEmailVerified=${user.is_email_verified}&isPhoneVerified=${user.is_phone_verified}`);
        });
      });
    } catch (error) {
      next(error);
    }
  }

  async appleLogin(req, res, next) {
    try {
      const { url, state } = authService.getAppleAuthUrl();
      
      res.cookie('oauth_state', state, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Lax',
        maxAge: 15 * 60 * 1000
      });

      res.redirect(url);
    } catch (error) {
      next(error);
    }
  }

  async appleCallback(req, res, next) {
    try {
      const { code, id_token, state, user: userPayload } = req.body;
      const storedState = req.cookies.oauth_state;

      if (!state || !storedState || state !== storedState) {
        const error = new Error('Invalid OAuth state. CSRF protection triggered.');
        error.statusCode = 403;
        throw error;
      }

      res.clearCookie('oauth_state');

      const { user, tokens } = await authService.appleLogin(code, id_token, userPayload);
      AuditService.log(req, 'user.oauth.apple.login', 'user', user.id);
      
      req.session.regenerate((err) => {
        if (err) return next(err);

        req.session.userId = user.id;
        req.session.role = user.role;

        req.session.save((saveErr) => {
          if (saveErr) return next(saveErr);
          if (res.headersSent) return;

          res.cookie('refreshToken', tokens.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'Strict',
            maxAge: 30 * 24 * 60 * 60 * 1000
          });

          res.redirect(`${process.env.CLIENT_URL}/oauth-success?isEmailVerified=${user.is_email_verified}&isPhoneVerified=${user.is_phone_verified}`);
        });
      });
    } catch (error) {
      next(error);
    }
  }

  async verifyEmail(req, res, next) {
    try {
      const { token } = req.query;
      await authService.verifyEmail(token);
      AuditService.log(req, 'user.email.verified', 'user', null);
      res.status(200).json({ success: true, message: 'Email verified successfully' });
    } catch (error) {
      next(error);
    }
  }

  async resendVerification(req, res, next) {
    try {
      const { email } = req.body;
      await authService.resendVerification(email);
      res.status(200).json({ success: true, message: 'Verification email sent' });
    } catch (error) {
      next(error);
    }
  }

  async sendPhoneOtp(req, res, next) {
    try {
      const { userId, phoneNumber, phoneCountryCode } = req.body;
      
      // Validate required fields
      if (!userId || !phoneNumber || !phoneCountryCode) {
        const error = new Error('userId, phoneNumber, and phoneCountryCode are required');
        error.statusCode = 400;
        throw error;
      }
      
      // Use registration service to send OTP
      await registrationService.sendPhoneOTP(userId, phoneNumber);
      
      AuditService.log(req, 'phone.otp.sent', 'user', userId);
      res.status(200).json({ 
        success: true, 
        message: `OTP sent to ${phoneCountryCode} ${phoneNumber}` 
      });
    } catch (error) {
      next(error);
    }
  }

  async resendPhoneOtp(req, res, next) {
    try {
      const { userId } = req.body;
      
      if (!userId) {
        const error = new Error('userId is required');
        error.statusCode = 400;
        throw error;
      }
      
      await registrationService.resendPhoneOTP(userId);
      
      AuditService.log(req, 'phone.otp.resent', 'user', userId);
      res.status(200).json({ 
        success: true, 
        message: 'OTP resent successfully' 
      });
    } catch (error) {
      next(error);
    }
  }

  async verifyPhone(req, res, next) {
    try {
      const { userId, otp } = req.body;
      
      // Validate required fields
      if (!userId || !otp) {
        const error = new Error('userId and otp are required');
        error.statusCode = 400;
        throw error;
      }
      
      // Use registration service to verify OTP
      const result = await registrationService.verifyPhoneOTP(userId, otp);
      
      AuditService.log(req, 'phone.otp.verified', 'user', userId);
      res.status(200).json({ 
        success: true, 
        message: 'Phone verified successfully',
        data: { isPhoneVerified: result.isPhoneVerified }
      });
    } catch (error) {
      next(error);
    }
  }

  async getOAuthStatus(req, res, next) {
    try {
      const status = await authService.getOAuthStatus(req.user.id);
      res.status(200).json({ success: true, data: status });
    } catch (error) {
      next(error);
    }
  }

  // Admin Controllers
  async adminListUsers(req, res, next) {
    try {
      const { page, limit, search } = req.query;
      const result = await authService.listUsers(parseInt(page), parseInt(limit), search);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

   async adminUpdateUserStatus(req, res, next) {
     try {
       const { id } = req.params;
       const { is_active, role } = req.body;
       const user = await authService.updateUserStatus(id, { is_active, role });
       res.status(200).json({ success: true, data: user });
     } catch (error) {
       next(error);
     }
   }

    async adminRegister(req, res, next) {
      // Admin registration is disabled - only one pre-defined admin allowed
      await AuditService.log(req, 'admin.registration.blocked', 'user', null, null, { email: req.body.email });
      
      res.status(403).json({
        success: false,
        message: 'Admin registration is disabled. Only one pre-defined admin account is allowed.'
      });
    }
 }
 
 module.exports = new AuthController();
