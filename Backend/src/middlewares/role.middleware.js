const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      const error = new Error('Not authenticated');
      error.statusCode = 401;
      return next(error);
    }

    const hasLegacyRole = req.user.role && roles.includes(req.user.role.toUpperCase());
    const hasNewRole = req.user.roles && req.user.roles.some(r => roles.some(role => role.toUpperCase() === r.toUpperCase()));

    if (!hasLegacyRole && !hasNewRole) {
      const error = new Error('Forbidden: Insufficient permissions');
      error.statusCode = 403;
      return next(error);
    }

    next();
  };
};

module.exports = authorize;
