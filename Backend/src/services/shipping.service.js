const shippingZoneModel = require('../models/shipping-zone.model');
const shippingRateModel = require('../models/shipping-rate.model');
const ErrorResponse = require('../utils/errorResponse');

class ShippingService {
  async getActiveZones() {
    return await shippingZoneModel.findAll({ isActive: true });
  }

  async calculateShippingOptions(address, cartTotal, cartWeight = 0) {
    if (!address || !address.country) {
      throw new ErrorResponse('Shipping address with country is required', 400);
    }

    const zones = await shippingZoneModel.findAll({ isActive: true });
    
    // Find matching zone
    let matchedZone = null;
    for (const zone of zones) {
      if (zone.countries.includes(address.country)) {
        // If state is "*", it matches any state in that country
        // Otherwise, check if the specific state is in the zone's states array
        const states = zone.states || [];
        if (
          states.length === 0 || 
          states.includes('*') || 
          (address.state && states.includes(address.state))
        ) {
          matchedZone = zone;
          break; // Use the first matching zone
        }
      }
    }

    if (!matchedZone) {
      // Return empty array or throw error if shipping isn't available
      return [];
    }

    // Get active rates for the matched zone
    const rates = await shippingRateModel.findByZoneId(matchedZone.id, { isActive: true });

    // Filter rates based on cart total and weight
    const availableOptions = rates.filter(rate => {
      // Check min order amount (e.g., Free shipping over $50)
      if (rate.min_order_amount && cartTotal < rate.min_order_amount) {
        // Only exclude if rate is 0.00 (free shipping tier) and total is below min.
        // Wait, standard rate could also have a min amount.
        // Let's strictly apply min_order_amount if it's > 0
        if (rate.rate == 0 && cartTotal < rate.min_order_amount) {
          return false;
        }
      }

      // Check weight constraints
      if (rate.min_weight && cartWeight < rate.min_weight) {
        return false;
      }
      if (rate.max_weight && cartWeight > rate.max_weight) {
        return false;
      }

      return true;
    });

    // Map to friendly format
    return availableOptions.map(rate => ({
      id: rate.id,
      name: rate.name,
      price: parseFloat(rate.rate),
      estimatedDays: rate.estimated_days_min && rate.estimated_days_max 
        ? `${rate.estimated_days_min}-${rate.estimated_days_max}` 
        : null
    })).sort((a, b) => a.price - b.price); // Sort cheapest first
  }
}

module.exports = new ShippingService();
