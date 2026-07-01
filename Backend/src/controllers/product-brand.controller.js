const brandModel = require('../models/product-brand.model');
const slugify = require('../utils/slug-generator');
const AuditService = require('../services/audit.service');

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

  async getBrandBySlug(req, res, next) {
    try {
      const brand = await brandModel.findBySlug(req.params.slug);
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

      // Guard against duplicate names/slugs before hitting the DB constraint
      const existingBySlug = await brandModel.findBySlug(slug);
      if (existingBySlug) {
        return res.status(409).json({ success: false, message: `A brand with the name "${name}" already exists` });
      }

      const brand = await brandModel.create({
        ...rest,
        name,
        slug,
        created_by: req.user.id
      });

      AuditService.log(req, 'brand.created', 'brand', brand.id, null, {
        name: brand.name,
        slug: brand.slug,
        description: brand.description,
        logo_url: brand.logo_url,
        is_featured: brand.is_featured,
        is_active: brand.is_active
      });

      res.status(201).json({ success: true, data: { brand } });
    } catch (error) {
      next(error);
    }
  }

  async updateBrand(req, res, next) {
    try {
      const { id } = req.params;
      const oldBrand = await brandModel.findById(id);
      const brand = await brandModel.update(id, req.body);

      const oldValues = oldBrand ? {
        name: oldBrand.name,
        slug: oldBrand.slug,
        description: oldBrand.description,
        logo_url: oldBrand.logo_url,
        is_featured: oldBrand.is_featured,
        is_active: oldBrand.is_active
      } : null;

      const newValues = {
        name: brand.name,
        slug: brand.slug,
        description: brand.description,
        logo_url: brand.logo_url,
        is_featured: brand.is_featured,
        is_active: brand.is_active
      };

      AuditService.log(req, 'brand.updated', 'brand', id, oldValues, newValues);
      res.status(200).json({ success: true, data: { brand } });
    } catch (error) {
      next(error);
    }
  }

  async deleteBrand(req, res, next) {
    try {
      const { id } = req.params;
      await brandModel.softDelete(id);
      AuditService.log(req, 'brand.deleted', 'brand', id);
      res.status(200).json({ success: true, message: 'Brand archived' });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ProductBrandController();
