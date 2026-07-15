const AuditLogModel = require('../../models/audit-log.model');
const auditExporter = require('../../utils/audit-exporter');
const AuditService = require('../../services/audit.service');

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

      if (req._auditScope && req._auditScope.filter) {
        result.logs = result.logs.filter(req._auditScope.filter);
      }

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

      let rows = await AuditLogModel.findAllExport({
        userId, action, resourceType, resourceId, fromDate, toDate,
        severity, actionType, actor, q,
      });

      if (req._auditScope && req._auditScope.filter) {
        rows = rows.filter(req._auditScope.filter);
      }

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

  /**
   * Non-repudiation verification of the audit hash chain.
   * POST /admin/audit/verify  (and GET for convenience)
   * Recomputes each row's record_hash from its predecessor and reports any
   * tampering.
   */
  async verifyChain(req, res, next) {
    try {
      const result = await AuditService.verifyChain();
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AdminAuditController();