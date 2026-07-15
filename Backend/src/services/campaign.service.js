const CampaignModel = require('../models/campaign.model');
const ErrorResponse = require('../utils/errorResponse');

class CampaignService {
  _validate(data) {
    if (data.starts_at && data.ends_at && new Date(data.ends_at) <= new Date(data.starts_at)) {
      throw new ErrorResponse('End date must be after start date', 400);
    }
    if (data.discount_type === 'percentage' && data.discount_value !== undefined && data.discount_value > 100) {
      throw new ErrorResponse('Percentage discount cannot exceed 100', 400);
    }
  }

  async getAllCampaigns(filters, pagination) {
    return await CampaignModel.findAll(filters, pagination);
  }

  async getCampaignById(id) {
    const campaign = await CampaignModel.findById(id);
    if (!campaign) throw new ErrorResponse('Campaign not found', 404);
    return campaign;
  }

  async createCampaign(data) {
    this._validate(data);
    const { product_ids, category_ids, brand_ids, ...campaignData } = data;
    return await CampaignModel.create(campaignData, {
      productIds: product_ids,
      categoryIds: category_ids,
      brandIds: brand_ids
    });
  }

  async updateCampaign(id, data) {
    this._validate(data);
    const { product_ids, category_ids, brand_ids, ...campaignData } = data;
    return await CampaignModel.update(id, campaignData, {
      productIds: product_ids,
      categoryIds: category_ids,
      brandIds: brand_ids
    });
  }

  async deleteCampaign(id) {
    return await CampaignModel.delete(id);
  }

  // Public: active campaigns right now (for future storefront/checkout consumption)
  async getActiveCampaigns() {
    return await CampaignModel.findActive();
  }

  /**
   * Compute the best applicable discount for a product from currently-active
   * campaigns. Not yet wired into checkout total calculation — exposed for
   * future storefront/checkout integration.
   */
  async getActiveDiscountForProduct(productId, categoryId = null, brandId = null) {
    const active = await CampaignModel.findActive();
    let best = null;

    for (const c of active) {
      const applies =
        c.scope === 'all_products' ||
        (c.scope === 'products' && c.campaign_products.some((p) => p.product_id === productId)) ||
        (c.scope === 'category' && categoryId && c.campaign_categories.some((cat) => cat.category_id === categoryId)) ||
        (c.scope === 'brand' && brandId && c.campaign_brands.some((b) => b.brand_id === brandId));

      if (!applies) continue;
      if (!best || Number(c.discount_value) > Number(best.discount_value)) best = c;
    }

    return best
      ? { campaignId: best.id, name: best.name, discountType: best.discount_type, discountValue: Number(best.discount_value) }
      : null;
  }
}

module.exports = new CampaignService();
