const express = require('express');
const router = express.Router();
const adminCmsController = require('../../controllers/admin/cms.admin.controller');
const requireAdmin = require('../../middlewares/require-admin.middleware');
const { hasPermission } = require('../../middlewares/permission.middleware');
const joi = require('joi');

const validateRequest = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({ success: false, error: error.details[0].message });
  }
  next();
};

const bannerSchema = joi.object({
  title: joi.string().required(),
  image_url: joi.string().uri().required(),
  link_url: joi.string().uri().optional().allow(''),
  position: joi.string().valid('hero', 'secondary', 'sidebar').optional(),
  sort_order: joi.number().integer().optional(),
  starts_at: joi.date().iso().optional().allow(null),
  ends_at: joi.date().iso().optional().allow(null),
  is_active: joi.boolean().optional()
});
const bannerUpdateSchema = bannerSchema.fork(Object.keys(bannerSchema.describe().keys), (s) => s.optional());

const pageSchema = joi.object({
  slug: joi.string().pattern(/^[a-z0-9-]+$/).required(),
  title: joi.string().required(),
  content: joi.string().optional().allow(''),
  status: joi.string().valid('draft', 'published').optional(),
  meta_title: joi.string().optional().allow(''),
  meta_description: joi.string().optional().allow('')
});
const pageUpdateSchema = pageSchema.fork(Object.keys(pageSchema.describe().keys), (s) => s.optional());

const postSchema = joi.object({
  slug: joi.string().pattern(/^[a-z0-9-]+$/).required(),
  title: joi.string().required(),
  excerpt: joi.string().optional().allow(''),
  content: joi.string().optional().allow(''),
  cover_image_url: joi.string().uri().optional().allow(''),
  status: joi.string().valid('draft', 'published').optional()
});
const postUpdateSchema = postSchema.fork(Object.keys(postSchema.describe().keys), (s) => s.optional());

router.use(requireAdmin);

/**
 * @swagger
 * tags:
 *   name: Admin CMS
 *   description: Admin management of banners, static pages, and blog posts
 */

/**
 * @swagger
 * /admin/cms/banners:
 *   get:
 *     summary: List all promotional banners
 *     tags: [Admin CMS]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of banners
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/banners', hasPermission('cms:read'), adminCmsController.getAllBanners);

/**
 * @swagger
 * /admin/cms/banners:
 *   post:
 *     summary: Create a promotional banner
 *     tags: [Admin CMS]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, image_url]
 *             properties:
 *               title: { type: string }
 *               image_url: { type: string, format: uri }
 *               link_url: { type: string, format: uri }
 *               position: { type: string, enum: [hero, secondary, sidebar] }
 *               sort_order: { type: integer }
 *               starts_at: { type: string, format: date-time, nullable: true }
 *               ends_at: { type: string, format: date-time, nullable: true }
 *               is_active: { type: boolean }
 *     responses:
 *       201:
 *         description: Banner created
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.post('/banners', hasPermission('cms:write'), validateRequest(bannerSchema), adminCmsController.createBanner);

/**
 * @swagger
 * /admin/cms/banners/{id}:
 *   patch:
 *     summary: Update a promotional banner
 *     tags: [Admin CMS]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string }
 *               image_url: { type: string, format: uri }
 *               link_url: { type: string, format: uri }
 *               position: { type: string, enum: [hero, secondary, sidebar] }
 *               sort_order: { type: integer }
 *               starts_at: { type: string, format: date-time, nullable: true }
 *               ends_at: { type: string, format: date-time, nullable: true }
 *               is_active: { type: boolean }
 *     responses:
 *       200:
 *         description: Banner updated
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 */
router.patch('/banners/:id', hasPermission('cms:write'), validateRequest(bannerUpdateSchema), adminCmsController.updateBanner);

/**
 * @swagger
 * /admin/cms/banners/{id}:
 *   delete:
 *     summary: Delete a promotional banner
 *     tags: [Admin CMS]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Banner deleted
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 */
router.delete('/banners/:id', hasPermission('cms:write'), adminCmsController.deleteBanner);

/**
 * @swagger
 * /admin/cms/pages:
 *   get:
 *     summary: List all static pages
 *     tags: [Admin CMS]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of pages
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/pages', hasPermission('cms:read'), adminCmsController.getAllPages);

/**
 * @swagger
 * /admin/cms/pages:
 *   post:
 *     summary: Create a static page
 *     tags: [Admin CMS]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [slug, title]
 *             properties:
 *               slug: { type: string, pattern: "^[a-z0-9-]+$" }
 *               title: { type: string }
 *               content: { type: string }
 *               status: { type: string, enum: [draft, published] }
 *               meta_title: { type: string }
 *               meta_description: { type: string }
 *     responses:
 *       201:
 *         description: Page created
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.post('/pages', hasPermission('cms:write'), validateRequest(pageSchema), adminCmsController.createPage);

/**
 * @swagger
 * /admin/cms/pages/{id}:
 *   patch:
 *     summary: Update a static page
 *     tags: [Admin CMS]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               slug: { type: string, pattern: "^[a-z0-9-]+$" }
 *               title: { type: string }
 *               content: { type: string }
 *               status: { type: string, enum: [draft, published] }
 *               meta_title: { type: string }
 *               meta_description: { type: string }
 *     responses:
 *       200:
 *         description: Page updated
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 */
router.patch('/pages/:id', hasPermission('cms:write'), validateRequest(pageUpdateSchema), adminCmsController.updatePage);

/**
 * @swagger
 * /admin/cms/pages/{id}:
 *   delete:
 *     summary: Delete a static page
 *     tags: [Admin CMS]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Page deleted
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 */
router.delete('/pages/:id', hasPermission('cms:write'), adminCmsController.deletePage);

/**
 * @swagger
 * /admin/cms/blog:
 *   get:
 *     summary: List all blog posts
 *     tags: [Admin CMS]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of blog posts
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/blog', hasPermission('cms:read'), adminCmsController.getAllBlogPosts);

/**
 * @swagger
 * /admin/cms/blog:
 *   post:
 *     summary: Create a blog post
 *     tags: [Admin CMS]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [slug, title]
 *             properties:
 *               slug: { type: string, pattern: "^[a-z0-9-]+$" }
 *               title: { type: string }
 *               excerpt: { type: string }
 *               content: { type: string }
 *               cover_image_url: { type: string, format: uri }
 *               status: { type: string, enum: [draft, published] }
 *     responses:
 *       201:
 *         description: Blog post created
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.post('/blog', hasPermission('cms:write'), validateRequest(postSchema), adminCmsController.createBlogPost);

/**
 * @swagger
 * /admin/cms/blog/{id}:
 *   patch:
 *     summary: Update a blog post
 *     tags: [Admin CMS]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               slug: { type: string, pattern: "^[a-z0-9-]+$" }
 *               title: { type: string }
 *               excerpt: { type: string }
 *               content: { type: string }
 *               cover_image_url: { type: string, format: uri }
 *               status: { type: string, enum: [draft, published] }
 *     responses:
 *       200:
 *         description: Blog post updated
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 */
router.patch('/blog/:id', hasPermission('cms:write'), validateRequest(postUpdateSchema), adminCmsController.updateBlogPost);

/**
 * @swagger
 * /admin/cms/blog/{id}:
 *   delete:
 *     summary: Delete a blog post
 *     tags: [Admin CMS]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Blog post deleted
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 */
router.delete('/blog/:id', hasPermission('cms:write'), adminCmsController.deleteBlogPost);

module.exports = router;
