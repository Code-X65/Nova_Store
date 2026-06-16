const AuditLogModel = require('../../models/audit-log.model');

class AdminAuditController {
  /**
   * Get general system activity audit logs
   * GET /admin/audit
   */
  async getActivityLogs(req, res, next) {
    try {
      const { page = 1, limit = 10, userId, action, resourceType, resourceId, fromDate, toDate } = req.query;
      const result = await AuditLogModel.findAll({
        userId,
        action,
        resourceType,
        resourceId,
        fromDate,
        toDate,
        page,
        limit
      });
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get authentication audit logs for admins
   * GET /admin/audit/auth
   */
  async getAuthAuditLogs(req, res, next) {
    try {
      const { page = 1, limit = 10, userId } = req.query;
      const result = await AuditLogModel.findAll({
        userId,
        action: 'user.login.%',
        page,
        limit
      });
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get admin authentication audit logs
   * GET /admin/audit/admin-auth
   */
  async getAdminAuthAuditLogs(req, res, next) {
    try {
      const { page = 1, limit = 10, userId } = req.query;
      const result = await AuditLogModel.findAll({
        userId,
        action: 'user.admin_login.%',
        page,
        limit
      });
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get audit log statistics
   * GET /admin/audit/stats
   */
  async getAuditStats(req, res, next) {
    try {
      const stats = await AuditLogModel.getStats();
      res.status(200).json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AdminAuditController();