const SettingModel = require('../models/setting.model');

module.exports = async (req, res, next) => {
  try {
    const isMaintenanceMode = await SettingModel.getByKey('maintenance_mode');
    
    if (isMaintenanceMode && isMaintenanceMode.value === 'true') {
      // Allow admins to bypass maintenance mode (both legacy and new RBAC admin checks)
      const isLegacyAdmin = req.user && req.user.role === 'ADMIN';
      const isNewAdmin = req.user && req.user.roles && (req.user.roles.includes('admin') || req.user.roles.includes('ADMIN'));
      
      if (isLegacyAdmin || isNewAdmin) {
        return next();
      }

      // Allow only admin login and user login so admins can authenticate during maintenance.
      // No registration or account-mutating endpoints are permitted.
      const allowedAuthPaths = [
        '/api/v1/auth/login',
        '/api/v1/auth/admin/login'
      ];
      
      // Standardize the path by removing trailing slashes
      const cleanPath = req.path.replace(/\/$/, '');
      if (allowedAuthPaths.includes(cleanPath)) {
        return next();
      }

      const messageSetting = await SettingModel.getByKey('maintenance_message');
      const message = messageSetting ? messageSetting.value : 'We are currently undergoing maintenance. Please check back later.';

      return res.status(503).json({
        success: false,
        message: message,
        isMaintenance: true
      });
    }

    next();
  } catch (err) {
    // Fail open if there's a DB issue, or fail closed? Fail open is safer for site availability.
    console.error('Failed to check maintenance mode:', err);
    next();
  }
};
