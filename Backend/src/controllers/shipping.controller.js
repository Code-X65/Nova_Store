const shippingService = require('../services/shipping.service');
const ErrorResponse = require('../utils/errorResponse');

exports.getZones = async (req, res, next) => {
  try {
    const zones = await shippingService.getActiveZones();
    res.status(200).json({
      success: true,
      data: zones
    });
  } catch (error) {
    next(error);
  }
};

exports.calculateShipping = async (req, res, next) => {
  try {
    const { address, cartTotal, cartWeight } = req.body;
    
    // In a real app, cartWeight might be computed dynamically by looking up the cartId.
    // For this endpoint, we'll accept it from the body, or default to 0.

    const shippingOptions = await shippingService.calculateShippingOptions(
      address, 
      cartTotal, 
      cartWeight || 0
    );

    res.status(200).json({
      success: true,
      data: {
        shippingOptions
      }
    });
  } catch (error) {
    next(error);
  }
};
