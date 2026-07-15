const express = require('express');
const router = express.Router();
const seoService = require('../../services/seo.service');

/**
 * @swagger
 * tags:
 *   - name: SEO
 *     description: Public SEO endpoints (robots.txt, sitemap.xml)
 */

/**
 * @swagger
 * /robots.txt:
 *   get:
 *     summary: Get the robots.txt file
 *     tags: [SEO]
 *     responses:
 *       200:
 *         description: robots.txt contents
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 */
router.get('/robots.txt', async (req, res) => {
  try {
    const robots = await seoService.getRobotsTxt();
    res.type('text/plain');
    res.send(robots);
  } catch (error) {
    res.status(500).type('text/plain').send('User-agent: *\nDisallow: /');
  }
});

/**
 * @swagger
 * /sitemap.xml:
 *   get:
 *     summary: Get the sitemap.xml file
 *     tags: [SEO]
 *     responses:
 *       200:
 *         description: sitemap.xml contents
 *         content:
 *           application/xml:
 *             schema:
 *               type: string
 *       404:
 *         description: No sitemap available
 */
router.get('/sitemap.xml', async (req, res) => {
  try {
    const protocol = req.protocol;
    const host = req.get('host');
    const baseUrl = `${protocol}://${host}`;
    const xml = await seoService.getSitemapXml(baseUrl);
    if (!xml) return res.status(404).type('application/xml').send('<?xml version="1.0"?><urlset/>');
    res.type('application/xml');
    res.send(xml);
  } catch (error) {
    res.status(500).type('application/xml').send('<?xml version="1.0"?><urlset/>');
  }
});

module.exports = router;
