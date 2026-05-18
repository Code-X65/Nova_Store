const jwt = require('jsonwebtoken');
const userModel = require('../models/user.model');
const permissionModel = require('../models/permission.model');
const userRoleModel = require('../models/user-role.model');

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

      // Get user from the token
      const user = await userModel.findById(decoded.id);
      
      if (!user) {
        return res.status(401).json({ success: false, message: 'Not authorized, user not found' });
      }

      // Eager load roles and permissions
      const [roles, permissions] = await Promise.all([
        userRoleModel.getUserRoles(user.id),
        permissionModel.getUserPermissions(user.id)
      ]);

      req.user = {
        ...user,
        roles: roles.map(r => r.name),
        permissions: permissions
      };

      next();
    } catch (error) {
      console.error(error);
      res.status(401).json({ success: false, message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    res.status(401).json({ success: false, message: 'Not authorized, no token' });
  }
};

const admin = (req, res, next) => {
  const isLegacyAdmin = req.user && req.user.role === 'ADMIN';
  const isNewAdmin = req.user && req.user.roles && req.user.roles.includes('admin');

  if (isLegacyAdmin || isNewAdmin) {
    next();
  } else {
    res.status(403).json({ success: false, message: 'Not authorized as an admin' });
  }
};

const optionalAuth = async (req, res, next) => {
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      const token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
      const user = await userModel.findById(decoded.id);
      if (user) {
        // Eager load roles and permissions for optional auth as well, enabling RBAC check in downstream middleware
        const [roles, permissions] = await Promise.all([
          userRoleModel.getUserRoles(user.id),
          permissionModel.getUserPermissions(user.id)
        ]);

        req.user = {
          ...user,
          roles: roles.map(r => r.name),
          permissions: permissions
        };
      }
    } catch (error) {
      // Ignore errors for optional auth
    }
  }
  next();
};

module.exports = { protect, admin, optionalAuth };
