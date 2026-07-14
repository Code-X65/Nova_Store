const shippingZoneModel = require('../../models/shipping-zone.model');
const shippingRateModel = require('../../models/shipping-rate.model');
const AuditService = require('../../services/audit.service');
const ErrorResponse = require('../../utils/errorResponse');

exports.getZones = async (req, res, next) => {
  try {
    const filters = {};
    if (req.query.isActive !== undefined) {
      filters.isActive = req.query.isActive === 'true';
    }
    const zones = await shippingZoneModel.findAll(filters);
    res.status(200).json({ success: true, data: zones });
  } catch (error) {
    next(error);
  }
};

exports.createZone = async (req, res, next) => {
  try {
    const zone = await shippingZoneModel.create(req.body);
    AuditService.log(req, 'shipping.zone.created', 'shipping_zone', zone.id, null, { name: zone.name, is_active: zone.is_active });
    res.status(201).json({ success: true, data: zone });
  } catch (error) {
    next(error);
  }
};

exports.updateZone = async (req, res, next) => {
  try {
    const oldZone = await shippingZoneModel.findById(req.params.id);
    const zone = await shippingZoneModel.update(req.params.id, req.body);

    const oldValues = oldZone ? { name: oldZone.name, is_active: oldZone.is_active, rate_strategy: oldZone.rate_strategy } : null;
    const newValues = { name: zone.name, is_active: zone.is_active, rate_strategy: zone.rate_strategy };

    AuditService.log(req, 'shipping.zone.updated', 'shipping_zone', req.params.id, oldValues, newValues);
    res.status(200).json({ success: true, data: zone });
  } catch (error) {
    next(error);
  }
};

exports.deleteZone = async (req, res, next) => {
  try {
    const zone = await shippingZoneModel.findById(req.params.id);
    await shippingZoneModel.delete(req.params.id);
    AuditService.log(req, 'shipping.zone.deleted', 'shipping_zone', req.params.id, null, { name: zone?.name });
    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    next(error);
  }
};

exports.getRates = async (req, res, next) => {
  try {
    const filters = {};
    if (req.query.isActive !== undefined) filters.isActive = req.query.isActive === 'true';
    if (req.query.zoneId) filters.zoneId = req.query.zoneId;

    const rates = await shippingRateModel.findAll(filters);
    res.status(200).json({ success: true, data: rates });
  } catch (error) {
    next(error);
  }
};

exports.createRate = async (req, res, next) => {
  try {
    const rate = await shippingRateModel.create(req.body);
    AuditService.log(req, 'shipping.rate.created', 'shipping_rate', rate.id, null, { zone_id: rate.zone_id, rate: rate.rate });
    res.status(201).json({ success: true, data: rate });
  } catch (error) {
    next(error);
  }
};

exports.updateRate = async (req, res, next) => {
  try {
    const oldRate = await shippingRateModel.findById(req.params.id);
    const rate = await shippingRateModel.update(req.params.id, req.body);

    const oldValues = oldRate ? { zone_id: oldRate.zone_id, rate: oldRate.rate } : null;
    const newValues = { zone_id: rate.zone_id, rate: rate.rate };

    AuditService.log(req, 'shipping.rate.updated', 'shipping_rate', req.params.id, oldValues, newValues);
    res.status(200).json({ success: true, data: rate });
  } catch (error) {
    next(error);
  }
};

exports.deleteRate = async (req, res, next) => {
  try {
    const rate = await shippingRateModel.findById(req.params.id);
    await shippingRateModel.delete(req.params.id);
    AuditService.log(req, 'shipping.rate.deleted', 'shipping_rate', req.params.id, null, { zone_id: rate?.zone_id, rate: rate?.rate });
    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    next(error);
  }
};
