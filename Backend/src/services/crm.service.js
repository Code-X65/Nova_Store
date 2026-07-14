const SegmentModel = require('../models/segment.model');
const CustomerEventModel = require('../models/customer-event.model');
const AuditService = require('./audit.service');

class CrmService {
  async listSegments(filters, pagination) {
    return await SegmentModel.findAll(filters, pagination);
  }

  async getSegment(id) {
    return await SegmentModel.findById(id);
  }

  async createSegment(segment, req = null) {
    const data = await SegmentModel.create(segment);
    if (req) await AuditService.log(req, 'segment.created', 'segment', data.id, null, data, { actionType: 'CREATE' });
    return data;
  }

  async updateSegment(id, updates, req = null) {
    const existing = await SegmentModel.findById(id);
    const data = await SegmentModel.update(id, updates);
    if (req) await AuditService.log(req, 'segment.updated', 'segment', id, existing, data, { actionType: 'UPDATE' });
    return data;
  }

  async deleteSegment(id, req = null) {
    const existing = await SegmentModel.findById(id);
    await SegmentModel.remove(id);
    if (req) await AuditService.log(req, 'segment.deleted', 'segment', id, existing, null, { actionType: 'DELETE' });
    return true;
  }

  async listCustomerEvents(filters, pagination) {
    return await CustomerEventModel.findAll(filters, pagination);
  }

  async getProductHeatmap(productId, from, to) {
    return await CustomerEventModel.getHeatmap(productId, from, to);
  }

  async getTopViewedProducts(from, to, limit = 10) {
    return await CustomerEventModel.getTopProducts(from, to, limit);
  }
}

module.exports = new CrmService();
