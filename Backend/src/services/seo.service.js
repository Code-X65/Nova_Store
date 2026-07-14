const SettingModel = require('../models/setting.model');

class SeoService {
  async getStoreSeo() {
    const settings = await SettingModel.getAll('seo');
    const seo = {};
    settings.forEach(s => {
      const key = s.key.includes('.') ? s.key.split('.')[1] : s.key;
      let value = s.value;
      if (s.value_type === 'boolean') value = s.value === 'true';
      else if (s.value_type === 'json') {
        try { value = JSON.parse(s.value); } catch (e) { value = null; }
      }
      seo[key] = value;
    });
    return seo;
  }

  async getRobotsTxt() {
    const seo = await this.getStoreSeo();
    return seo.robots_txt || 'User-agent: *\nAllow: /\nDisallow: /admin/\n';
  }

  async getSitemapXml(baseUrl) {
    const seo = await this.getStoreSeo();
    if (seo.sitemap_enabled === false) return null;

    const products = await SettingModel.getAll('_seo_products');
    const categories = await SettingModel.getAll('_seo_categories');

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
    xml += `  <url>\n    <loc>${baseUrl}</loc>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>\n`;

    (categories || []).forEach((c) => {
      const loc = c.value;
      if (loc) xml += `  <url>\n    <loc>${loc}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
    });

    (products || []).forEach((p) => {
      const loc = p.value;
      if (loc) xml += `  <url>\n    <loc>${loc}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.6</priority>\n  </url>\n`;
    });

    xml += '</urlset>';
    return xml;
  }

  async getJsonLd() {
    const seo = await this.getStoreSeo();
    if (seo.json_ld_enabled === false) return null;

    const storeSettings = await SettingModel.getAll('store');
    const storeName = storeSettings.find((s) => s.key === 'store.name')?.value || 'Nova Store';
    const storeEmail = storeSettings.find((s) => s.key === 'store.email')?.value || '';

    return {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: storeName,
      description: seo.meta_description || '',
      email: storeEmail,
    };
  }
}

module.exports = new SeoService();
