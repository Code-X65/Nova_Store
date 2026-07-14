const AuditLogModel = require('../../models/audit-log.model');
const { translateLog } = require('../../services/catalog-audit-translator.service');

class CatalogAuditController {
  async getCatalogLogs(req, res, next) {
    try {
      const { page = 1, limit = 20, entityType, entityId, actionType, changeCategory, fromDate, toDate, q } = req.query;
      const result = await AuditLogModel.findAll({
        resourceType: entityType || undefined,
        resourceId: entityId || undefined,
        actionType: actionType || undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        q: q || undefined,
        page: parseInt(page),
        limit: parseInt(limit),
      });

      if (req._auditScope && req._auditScope.filter) {
        result.logs = result.logs.filter(req._auditScope.filter);
      }

      result.logs = result.logs.map(log => ({
        ...log,
        human_readable: translateLog(log),
      }));

      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async getEntityTimeline(req, res, next) {
    try {
      const { type, id } = req.params;
      const { limit = 50, offset = 0 } = req.query;
      const page = Math.floor(parseInt(offset) / parseInt(limit)) + 1;
      const result = await AuditLogModel.findAll({
        resourceType: type,
        resourceId: id,
        page,
        limit: parseInt(limit),
      });

      if (req._auditScope && req._auditScope.filter) {
        result.logs = result.logs.filter(req._auditScope.filter);
      }

      result.logs = result.logs.map(log => ({
        ...log,
        human_readable: translateLog(log),
      }));

      res.status(200).json({ success: true, data: { entityType: type, entityId: id, history: result.logs } });
    } catch (error) {
      next(error);
    }
  }

  async getCatalogStats(req, res, next) {
    try {
      const { fromDate, toDate } = req.query;
      const stats = await AuditLogModel.getCatalogStats(fromDate || undefined, toDate || undefined, req._auditScope);
      res.status(200).json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  }

  async exportCatalog(req, res, next) {
    try {
      const { entityType, entityId, actionType, changeCategory, fromDate, toDate, q, format = 'csv' } = req.query;
      const rows = await AuditLogModel.findAllExport({
        resourceType: entityType,
        resourceId: entityId,
        actionType,
        fromDate,
        toDate,
        q,
      });

      if (req._auditScope && req._auditScope.filter) {
        rows = rows.filter(req._auditScope.filter);
      }

      rows.forEach(row => {
        row.human_readable = translateLog(row);
      });

      if (format === 'pdf') {
        const auditExporter = require('../../utils/audit-exporter');
        const buffer = await auditExporter.toPDF(rows.map(r => ({
          ...r,
          summary: r.human_readable || r.summary,
        })));
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=catalog-audit-export-${Date.now()}.pdf`);
        return res.send(buffer);
      }

      const auditExporter = require('../../utils/audit-exporter');
      const csv = auditExporter.toCSV(rows.map(r => ({
        ...r,
        summary: r.human_readable || r.summary,
      })));
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=catalog-audit-export-${Date.now()}.csv`);
      return res.send(csv);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new CatalogAuditController();
