const TwoFactorService = require('../../services/two-factor.service');
const userModel = require('../../models/user.model');
const AuditService = require('../../services/audit.service');

class SecurityController {
  async get2faStatus(req, res, next) {
    try {
      const status = await TwoFactorService.getStatus(req.admin.id);
      res.status(200).json({ success: true, data: status });
    } catch (error) {
      next(error);
    }
  }

  async enable2fa(req, res, next) {
    try {
      const result = await TwoFactorService.enable(req.admin.id);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async verify2fa(req, res, next) {
    try {
      const { token } = req.body;
      if (!token) {
        return res.status(400).json({ success: false, error: 'Token is required' });
      }
      const result = await TwoFactorService.verify(req.admin.id, token);
      if (!result.verified) {
        return res.status(401).json({ success: false, error: 'Invalid token' });
      }
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async disable2fa(req, res, next) {
    try {
      const { password } = req.body;
      const user = await userModel.findById(req.admin.id);
      if (!user) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }
      const bcrypt = require('bcrypt');
      const passwordMatch = await userModel.comparePassword(password, user.password_hash);
      await TwoFactorService.disable(req.admin.id, passwordMatch);
      res.status(200).json({ success: true, message: '2FA disabled' });
    } catch (error) {
      next(error);
    }
  }

  async useRecoveryCode(req, res, next) {
    try {
      const { code } = req.body;
      if (!code) {
        return res.status(400).json({ success: false, error: 'Recovery code is required' });
      }
      const result = await TwoFactorService.useRecoveryCode(req.admin.id, code);
      if (!result.success) {
        return res.status(401).json({ success: false, error: result.reason });
      }
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new SecurityController();
