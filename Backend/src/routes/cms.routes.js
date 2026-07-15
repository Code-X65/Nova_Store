const express = require('express');
const router = express.Router();
const cmsController = require('../controllers/cms.controller');

/**
 * @swagger
 * tags:
 *   name: CMS
 *   description: Public content endpoints (banners, pages, blog)
 */

router.get('/banners/active', cmsController.getActiveBanners);
router.get('/pages/:slug', cmsController.getPage);
router.get('/blog', cmsController.getBlogPosts);
router.get('/blog/:slug', cmsController.getBlogPost);

module.exports = router;
