const userService = require('../services/user.service');
const AuditService = require('../services/audit.service');

class UserController {
  async getProfile(req, res, next) {
    try {
      const profile = await userService.getProfile(req.user.id);
      res.status(200).json({ success: true, data: profile });
    } catch (error) {
      next(error);
    }
  }

  async updateProfile(req, res, next) {
    try {
      const profile = await userService.updateProfile(req.user.id, req.body);
      AuditService.log(req, 'user.profile.updated', 'user', req.user.id, null, req.body);
      res.status(200).json({ success: true, data: profile });
    } catch (error) {
      next(error);
    }
  }

  async uploadAvatar(req, res, next) {
    try {
      if (!req.file) {
        const error = new Error('Please upload a file');
        error.statusCode = 400;
        throw error;
      }
      const avatarUrl = await userService.uploadAvatar(req.user.id, req.file);
      AuditService.log(req, 'user.avatar.uploaded', 'user', req.user.id);
      res.status(200).json({ success: true, avatarUrl });
    } catch (error) {
      next(error);
    }
  }

  async deleteAvatar(req, res, next) {
    try {
      await userService.deleteAvatar(req.user.id);
      AuditService.log(req, 'user.avatar.deleted', 'user', req.user.id);
      res.status(200).json({ success: true, message: 'Avatar deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  async requestEmailChange(req, res, next) {
    try {
      const { newEmail } = req.body;
      await userService.requestEmailChange(req.user.id, newEmail);
      AuditService.log(req, 'user.email.change_requested', 'user', req.user.id, null, { newEmail });
      res.status(200).json({ success: true, message: 'Verification email sent to new address' });
    } catch (error) {
      next(error);
    }
  }

  async verifyEmailChange(req, res, next) {
    try {
      const { token, newEmail } = req.body;
      await userService.verifyEmailChange(req.user.id, token, newEmail);
      AuditService.log(req, 'user.email.changed', 'user', req.user.id, null, { newEmail });
      res.status(200).json({ success: true, message: 'Email updated successfully' });
    } catch (error) {
      next(error);
    }
  }

  async deleteAccount(req, res, next) {
    try {
      await userService.deleteAccount(req.user.id);
      AuditService.log(req, 'user.account.deleted', 'user', req.user.id);
      // Optional: Clear cookies
      res.status(200).json({ success: true, message: 'Account deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new UserController();
