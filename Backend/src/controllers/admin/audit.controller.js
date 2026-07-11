const AuditLogModel = require('../../models/audit-log.model');
const auditExporter = require('../../utils/audit-exporter');

class AdminAuditController {
  /**
   * Get general system activity audit logs
   * GET /admin/audit
   */
  async getActivityLogs(req, res, next) {
    try {
      const { page = 1, limit = 10, userId, action, resourceType, resourceId, fromDate, toDate,
        severity, actionType, actor, q } = req.query;
      const result = await AuditLogModel.findAll({
        userId,
        action,
        resourceType,
        resourceId,
        fromDate,
        toDate,
        severity,
        actionType,
        actor,
        q,
        page,
        limit
      });
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Export audit logs to CSV or PDF.
   * GET /admin/audit/export?format=csv|pdf
   */
  async exportLogs(req, res, next) {
    try {
      const { userId, action, resourceType, resourceId, fromDate, toDate,
        severity, actionType, actor, q, format = 'csv' } = req.query;

      const rows = await AuditLogModel.findAllExport({
        userId, action, resourceType, resourceId, fromDate, toDate,
        severity, actionType, actor, q,
      });

      if (format === 'pdf') {
        const buffer = await auditExporter.toPDF(rows);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=audit-export-${Date.now()}.pdf`);
        return res.send(buffer);
      }

      const csv = auditExporter.toCSV(rows);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=audit-export-${Date.now()}.csv`);
      return res.send(csv);
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