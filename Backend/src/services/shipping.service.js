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
    
    let matchedZone = null;
    for (const zone of zones) {
      if (zone.countries.includes(address.country)) {
        const states = zone.states || [];
        if (
          states.length === 0 || 
          states.includes('*') || 
          (address.state && states.includes(address.state))
        ) {
          matchedZone = zone;
          break;
        }
      }
    }

    if (!matchedZone) {
      return [];
    }

    const rates = await shippingRateModel.findByZoneId(matchedZone.id, { isActive: true });

    let availableOptions = rates.filter(rate => {
      if (rate.min_order_amount && cartTotal < rate.min_order_amount) {
        if (rate.rate == 0 && cartTotal < rate.min_order_amount) {
          return false;
        }
      }
      if (rate.min_weight && cartWeight < rate.min_weight) {
        return false;
      }
      if (rate.max_weight && cartWeight > rate.max_weight) {
        return false;
      }
      return true;
    });

    const strategy = matchedZone.rate_strategy && typeof matchedZone.rate_strategy === 'object'
      ? matchedZone.rate_strategy
      : null;

    if (strategy && strategy.type) {
      const existingIds = new Set(availableOptions.map(r => r.id));
      if (strategy.type === 'flat' && strategy.amount != null && !existingIds.has('zone-flat')) {
        availableOptions.push({
          id: 'zone-flat',
          name: strategy.name || 'Standard Flat',
          rate: Number(strategy.amount),
          estimated_days_min: strategy.estimated_days_min || null,
          estimated_days_max: strategy.estimated_days_max || null,
          isActive: true,
        });
      } else if (strategy.type === 'free_over_x' && strategy.threshold != null) {
        if (cartTotal >= Number(strategy.threshold)) {
          availableOptions = availableOptions.map(r => ({ ...r, rate: 0 }));
        }
      } else if (strategy.type === 'price_threshold' && strategy.threshold != null && strategy.amount != null) {
        if (cartTotal >= Number(strategy.threshold)) {
          const flatId = 'zone-threshold';
          if (!existingIds.has(flatId)) {
            availableOptions.push({
              id: flatId,
              name: strategy.name || 'Discounted Rate',
              rate: Number(strategy.amount),
              estimated_days_min: strategy.estimated_days_min || null,
              estimated_days_max: strategy.estimated_days_max || null,
              isActive: true,
            });
          }
        }
      }
    }

    return availableOptions.map(rate => ({
      id: rate.id,
      name: rate.name,
      price: parseFloat(rate.rate),
      estimatedDays: rate.estimated_days_min && rate.estimated_days_max 
        ? `${rate.estimated_days_min}-${rate.estimated_days_max}` 
        : null
    })).sort((a, b) => a.price - b.price);
  }
}

module.exports = new ShippingService();
