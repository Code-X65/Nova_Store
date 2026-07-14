const express = require('express');
const router = express.Router();
const seoService = require('../../services/seo.service');

router.get('/robots.txt', async (req, res) => {
  try {
    const robots = await seoService.getRobotsTxt();
    res.type('text/plain');
    res.send(robots);
  } catch (error) {
    res.status(500).type('text/plain').send('User-agent: *\nDisallow: /');
  }
});

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
