const shippingZoneModel = require('../../models/shipping-zone.model');
const shippingRateModel = require('../../models/shipping-rate.model');
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
    res.status(201).json({ success: true, data: zone });
  } catch (error) {
    next(error);
  }
};

exports.updateZone = async (req, res, next) => {
  try {
    const zone = await shippingZoneModel.update(req.params.id, req.body);
    res.status(200).json({ success: true, data: zone });
  } catch (error) {
    next(error);
  }
};

exports.deleteZone = async (req, res, next) => {
  try {
    await shippingZoneModel.delete(req.params.id);
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
    res.status(201).json({ success: true, data: rate });
  } catch (error) {
    next(error);
  }
};

exports.updateRate = async (req, res, next) => {
  try {
    const rate = await shippingRateModel.update(req.params.id, req.body);
    res.status(200).json({ success: true, data: rate });
  } catch (error) {
    next(error);
  }
};

exports.deleteRate = async (req, res, next) => {
  try {
    await shippingRateModel.delete(req.params.id);
    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    next(error);
  }
};
