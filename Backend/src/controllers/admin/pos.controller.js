const PosService = require('../../services/pos.service');
const AuditService = require('../../services/audit.service');

exports.createSale = async (req, res, next) => {
  try {
    const adminId = req.admin?.id || req.user?.id;
    const order = await PosService.createWalkInSale(adminId, req.body);
    AuditService.log(req, 'pos.sale_created', 'order', order.id, null, {
      orderNumber: order.order_number,
      total: order.total_amount
    });
    res.status(201).json({ success: true, data: { order } });
  } catch (error) {
    next(error);
  }
};

exports.getSales = async (req, res, next) => {
  try {
    const { page, limit, dateFrom, dateTo } = req.query;
    const result = await PosService.getPosSales(
      { dateFrom, dateTo },
      { page: parseInt(page) || 1, limit: parseInt(limit) || 20 }
    );
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

exports.getSaleById = async (req, res, next) => {
  try {
    const order = await PosService.getPosSaleById(req.params.id);
    res.status(200).json({ success: true, data: { order } });
  } catch (error) {
    next(error);
  }
};
