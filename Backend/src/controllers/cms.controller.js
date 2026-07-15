const CmsService = require('../services/cms.service');

exports.getActiveBanners = async (req, res, next) => {
  try {
    const { position } = req.query;
    const banners = await CmsService.getActiveBanners(position || null);
    res.status(200).json({ success: true, data: { banners } });
  } catch (error) { next(error); }
};

exports.getPage = async (req, res, next) => {
  try {
    const page = await CmsService.getPublishedPage(req.params.slug);
    res.status(200).json({ success: true, data: { page } });
  } catch (error) { next(error); }
};

exports.getBlogPosts = async (req, res, next) => {
  try {
    const { page, limit } = req.query;
    const result = await CmsService.getPublishedBlogPosts({
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20
    });
    res.status(200).json({ success: true, data: result });
  } catch (error) { next(error); }
};

exports.getBlogPost = async (req, res, next) => {
  try {
    const post = await CmsService.getPublishedBlogPost(req.params.slug);
    res.status(200).json({ success: true, data: { post } });
  } catch (error) { next(error); }
};
