const brandModel = require('../models/product-brand.model');
const slugify = require('../utils/slug-generator');

class ProductBrandController {
  async getAllBrands(req, res, next) {
    try {
      const brands = await brandModel.findAll(req.query);
      res.status(200).json({ success: true, data: { brands } });
    } catch (error) {
      next(error);
    }
  }

  async getBrandById(req, res, next) {
    try {
      const brand = await brandModel.findById(req.params.id);
      if (!brand) {
        return res.status(404).json({ success: false, message: 'Brand not found' });
      }
      res.status(200).json({ success: true, data: { brand } });
    } catch (error) {
      next(error);
    }
  }

  async createBrand(req, res, next) {
    try {
      const { name, ...rest } = req.body;
      let slug = slugify(name);
      
      const brand = await brandModel.create({
        ...rest,
        name,
        slug,
        created_by: req.user.id
      });
      
      res.status(201).json({ success: true, data: { brand } });
    } catch (error) {
      next(error);
    }
  }

  async updateBrand(req, res, next) {
    try {
      const brand = await brandModel.update(req.params.id, req.body);
      res.status(200).json({ success: true, data: { brand } });
    } catch (error) {
      next(error);
    }
  }

  async deleteBrand(req, res, next) {
    try {
      await brandModel.softDelete(req.params.id);
      res.status(200).json({ success: true, message: 'Brand archived' });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ProductBrandController();
