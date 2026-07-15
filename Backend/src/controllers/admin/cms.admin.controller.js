const CmsService = require('../../services/cms.service');
const AuditService = require('../../services/audit.service');

// ── Banners ──────────────────────────────────────────────────────────────
exports.getAllBanners = async (req, res, next) => {
  try {
    const { position, isActive } = req.query;
    const filters = {};
    if (position) filters.position = position;
    if (isActive !== undefined) filters.isActive = isActive === 'true';
    const banners = await CmsService.getAllBanners(filters);
    res.status(200).json({ success: true, data: { banners } });
  } catch (error) { next(error); }
};

exports.createBanner = async (req, res, next) => {
  try {
    const banner = await CmsService.createBanner(req.body);
    AuditService.log(req, 'cms.banner_created', 'cms_banner', banner.id, null, req.body);
    res.status(201).json({ success: true, data: { banner } });
  } catch (error) { next(error); }
};

exports.updateBanner = async (req, res, next) => {
  try {
    const banner = await CmsService.updateBanner(req.params.id, req.body);
    AuditService.log(req, 'cms.banner_updated', 'cms_banner', req.params.id, null, req.body);
    res.status(200).json({ success: true, data: { banner } });
  } catch (error) { next(error); }
};

exports.deleteBanner = async (req, res, next) => {
  try {
    await CmsService.deleteBanner(req.params.id);
    AuditService.log(req, 'cms.banner_deleted', 'cms_banner', req.params.id);
    res.status(200).json({ success: true, data: {}, message: 'Banner deleted' });
  } catch (error) { next(error); }
};

// ── Pages ────────────────────────────────────────────────────────────────
exports.getAllPages = async (req, res, next) => {
  try {
    const { status } = req.query;
    const pages = await CmsService.getAllPages(status ? { status } : {});
    res.status(200).json({ success: true, data: { pages } });
  } catch (error) { next(error); }
};

exports.createPage = async (req, res, next) => {
  try {
    const page = await CmsService.createPage(req.body);
    AuditService.log(req, 'cms.page_created', 'cms_page', page.id, null, req.body);
    res.status(201).json({ success: true, data: { page } });
  } catch (error) { next(error); }
};

exports.updatePage = async (req, res, next) => {
  try {
    const page = await CmsService.updatePage(req.params.id, req.body);
    AuditService.log(req, 'cms.page_updated', 'cms_page', req.params.id, null, req.body);
    res.status(200).json({ success: true, data: { page } });
  } catch (error) { next(error); }
};

exports.deletePage = async (req, res, next) => {
  try {
    await CmsService.deletePage(req.params.id);
    AuditService.log(req, 'cms.page_deleted', 'cms_page', req.params.id);
    res.status(200).json({ success: true, data: {}, message: 'Page deleted' });
  } catch (error) { next(error); }
};

// ── Blog posts ───────────────────────────────────────────────────────────
exports.getAllBlogPosts = async (req, res, next) => {
  try {
    const { status, page, limit } = req.query;
    const result = await CmsService.getAllBlogPosts(status ? { status } : {}, {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20
    });
    res.status(200).json({ success: true, data: result });
  } catch (error) { next(error); }
};

exports.createBlogPost = async (req, res, next) => {
  try {
    const adminId = req.admin?.id || req.user?.id;
    const post = await CmsService.createBlogPost(adminId, req.body);
    AuditService.log(req, 'cms.blog_post_created', 'cms_blog_post', post.id, null, req.body);
    res.status(201).json({ success: true, data: { post } });
  } catch (error) { next(error); }
};

exports.updateBlogPost = async (req, res, next) => {
  try {
    const post = await CmsService.updateBlogPost(req.params.id, req.body);
    AuditService.log(req, 'cms.blog_post_updated', 'cms_blog_post', req.params.id, null, req.body);
    res.status(200).json({ success: true, data: { post } });
  } catch (error) { next(error); }
};

exports.deleteBlogPost = async (req, res, next) => {
  try {
    await CmsService.deleteBlogPost(req.params.id);
    AuditService.log(req, 'cms.blog_post_deleted', 'cms_blog_post', req.params.id);
    res.status(200).json({ success: true, data: {}, message: 'Blog post deleted' });
  } catch (error) { next(error); }
};
