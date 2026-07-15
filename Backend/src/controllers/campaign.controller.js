const CampaignService = require('../services/campaign.service');

exports.getActiveCampaigns = async (req, res, next) => {
  try {
    const campaigns = await CampaignService.getActiveCampaigns();
    res.status(200).json({ success: true, data: { campaigns } });
  } catch (error) {
    next(error);
  }
};
