const CampaignService = require('../../services/campaign.service');
const AuditService = require('../../services/audit.service');

exports.getAllCampaigns = async (req, res, next) => {
  try {
    const { isActive, scope, name, page, limit } = req.query;
    const filters = {};
    if (isActive !== undefined) filters.isActive = isActive === 'true';
    if (scope) filters.scope = scope;
    if (name) filters.name = name;

    const result = await CampaignService.getAllCampaigns(filters, {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20
    });

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

exports.getCampaignById = async (req, res, next) => {
  try {
    const campaign = await CampaignService.getCampaignById(req.params.id);
    res.status(200).json({ success: true, data: { campaign } });
  } catch (error) {
    next(error);
  }
};

exports.createCampaign = async (req, res, next) => {
  try {
    const campaign = await CampaignService.createCampaign({ ...req.body, created_by: req.admin?.id || req.user?.id || null });
    AuditService.log(req, 'campaign.created', 'campaign', campaign.id, null, req.body);
    res.status(201).json({ success: true, data: { campaign } });
  } catch (error) {
    next(error);
  }
};

exports.updateCampaign = async (req, res, next) => {
  try {
    const campaign = await CampaignService.updateCampaign(req.params.id, req.body);
    AuditService.log(req, 'campaign.updated', 'campaign', req.params.id, null, req.body);
    res.status(200).json({ success: true, data: { campaign } });
  } catch (error) {
    next(error);
  }
};

exports.deleteCampaign = async (req, res, next) => {
  try {
    await CampaignService.deleteCampaign(req.params.id);
    AuditService.log(req, 'campaign.deleted', 'campaign', req.params.id);
    res.status(200).json({ success: true, data: {}, message: 'Campaign deleted' });
  } catch (error) {
    next(error);
  }
};
