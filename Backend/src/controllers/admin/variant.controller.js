const CatalogVariantService = require('../../services/catalog-variant.service');

class VariantController {
  async getOptions(req, res, next) {
    try {
      const data = await CatalogVariantService.getVariantOptions(req.params.id);
      res.json({ success: true, data });
    } catch (error) { next(error); }
  }

  async replaceOptions(req, res, next) {
    try {
      const data = await CatalogVariantService.replaceVariantOptions(req.params.id, req.body.options);
      res.json({ success: true, data });
    } catch (error) { next(error); }
  }
}

module.exports = new VariantController();
