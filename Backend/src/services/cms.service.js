const CmsBannerModel = require('../models/cms-banner.model');
const CmsPageModel = require('../models/cms-page.model');
const CmsBlogPostModel = require('../models/cms-blog-post.model');
const ErrorResponse = require('../utils/errorResponse');

class CmsService {
  // ── Banners ────────────────────────────────────────────────────────────
  async getAllBanners(filters) {
    return await CmsBannerModel.findAll(filters);
  }

  async getActiveBanners(position) {
    return await CmsBannerModel.findActive(position);
  }

  async createBanner(data) {
    return await CmsBannerModel.create(data);
  }

  async updateBanner(id, data) {
    const banner = await CmsBannerModel.findById(id);
    if (!banner) throw new ErrorResponse('Banner not found', 404);
    return await CmsBannerModel.update(id, data);
  }

  async deleteBanner(id) {
    return await CmsBannerModel.delete(id);
  }

  // ── Pages ──────────────────────────────────────────────────────────────
  async getAllPages(filters) {
    return await CmsPageModel.findAll(filters);
  }

  async getPublishedPage(slug) {
    const page = await CmsPageModel.findBySlug(slug, { publishedOnly: true });
    if (!page) throw new ErrorResponse('Page not found', 404);
    return page;
  }

  async createPage(data) {
    if (data.status === 'published' && !data.published_at) data.published_at = new Date().toISOString();
    return await CmsPageModel.create(data);
  }

  async updatePage(id, data) {
    const page = await CmsPageModel.findById(id);
    if (!page) throw new ErrorResponse('Page not found', 404);
    if (data.status === 'published' && page.status !== 'published') data.published_at = new Date().toISOString();
    return await CmsPageModel.update(id, data);
  }

  async deletePage(id) {
    return await CmsPageModel.delete(id);
  }

  // ── Blog posts ─────────────────────────────────────────────────────────
  async getAllBlogPosts(filters, pagination) {
    return await CmsBlogPostModel.findAll(filters, pagination);
  }

  async getPublishedBlogPosts(pagination) {
    return await CmsBlogPostModel.findAll({ status: 'published' }, pagination);
  }

  async getPublishedBlogPost(slug) {
    const post = await CmsBlogPostModel.findBySlug(slug, { publishedOnly: true });
    if (!post) throw new ErrorResponse('Blog post not found', 404);
    return post;
  }

  async createBlogPost(authorAdminId, data) {
    if (data.status === 'published' && !data.published_at) data.published_at = new Date().toISOString();
    return await CmsBlogPostModel.create({ ...data, author_admin_id: authorAdminId });
  }

  async updateBlogPost(id, data) {
    const post = await CmsBlogPostModel.findById(id);
    if (!post) throw new ErrorResponse('Blog post not found', 404);
    if (data.status === 'published' && post.status !== 'published') data.published_at = new Date().toISOString();
    return await CmsBlogPostModel.update(id, data);
  }

  async deleteBlogPost(id) {
    return await CmsBlogPostModel.delete(id);
  }
}

module.exports = new CmsService();
