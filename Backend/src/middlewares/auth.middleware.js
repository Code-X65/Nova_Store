const jwt = require('jsonwebtoken');
const userModel = require('../models/user.model');
const permissionModel = require('../models/permission.model');
const userRoleModel = require('../models/user-role.model');

const protect = async (req, res, next) => {
  // Check for session-based admin auth first
  if (req.session && req.session.adminId) {
    try {
      const adminModel = require('../models/admin.model');
      const admin = await adminModel.findById(req.session.adminId);
      
      if (admin && admin.is_active) {
        req.admin = admin;
        req.user = {
          id: admin.id,
          email: admin.email,
          role: 'admin',
          roles: ['admin'],
          permissions: ['*']
        };
        return next();
      }
    } catch (error) {
      console.error('Session authentication error in protect middleware:', error);
    }
  }

  // Check for session-based customer (user) auth next
  if (req.session && req.session.userId) {
    try {
      const user = await userModel.findById(req.session.userId);
      if (user && user.is_active) {
        const [roles, permissions] = await Promise.all([
          userRoleModel.getUserRoles(user.id),
          permissionModel.getUserPermissions(user.id)
        ]);

        req.user = {
          ...user,
          roles: roles.map(r => r.name),
          permissions: permissions
        };
        return next();
      }
    } catch (error) {
      console.error('Session user authentication error in protect middleware:', error);
    }
  }

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

      return next();
    } catch (error) {
      console.error(error);
      return res.status(401).json({ success: false, message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized, no token' });
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
  // Check session first
  if (req.session && req.session.userId) {
    try {
      const user = await userModel.findById(req.session.userId);
      if (user && user.is_active) {
        const [roles, permissions] = await Promise.all([
          userRoleModel.getUserRoles(user.id),
          permissionModel.getUserPermissions(user.id)
        ]);

        req.user = {
          ...user,
          roles: roles.map(r => r.name),
          permissions: permissions
        };
        return next();
      }
    } catch (error) {
      // Ignore session verification errors
    }
  }

  // Fallback to session admin
  if (req.session && req.session.adminId) {
    try {
      const adminModel = require('../models/admin.model');
      const admin = await adminModel.findById(req.session.adminId);
      if (admin && admin.is_active) {
        req.admin = admin;
        req.user = {
          id: admin.id,
          email: admin.email,
          role: 'admin',
          roles: ['admin'],
          permissions: ['*']
        };
        return next();
      }
    } catch (error) {
      // Ignore session verification errors
    }
  }

  // Fallback to Bearer token
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
