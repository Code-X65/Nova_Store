const categoryAttributeModel = require('../models/category-attribute.model');
const attributeService       = require('../services/attribute.service');
const AuditService           = require('../services/audit.service');

class AttributeController {
  /**
   * GET /categories/:id/attributes
   * Returns all attribute templates for a category, including inherited ones.
   */
  async getAttributes(req, res, next) {
    try {
      const { id } = req.params;
      const attributes = await attributeService.getInheritedAttributes(id);
      res.status(200).json({ success: true, data: { attributes } });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /categories/:id/attributes
   * Create a new attribute template on a category.
   */
  async createAttribute(req, res, next) {
    try {
      const { id: category_id } = req.params;
      const {
        attribute_name,
        attribute_type = 'text',
        is_required    = false,
        unit,
        allowed_values,
        display_order  = 0
      } = req.body;

      // Validate enum has allowed_values
      if (attribute_type === 'enum' && (!allowed_values || allowed_values.length === 0)) {
        return res.status(400).json({
          success: false,
          message: 'allowed_values must be provided for enum attributes.'
        });
      }

      const attribute = await categoryAttributeModel.create({
        category_id,
        attribute_name,
        attribute_type,
        is_required,
        unit:           unit || null,
        allowed_values: allowed_values || null,
        display_order
      });

      AuditService.log(req, 'attribute.created', 'category_attribute', attribute.id, null, {
        category_id,
        attribute_name,
        attribute_type,
        is_required
      });

      res.status(201).json({ success: true, data: { attribute } });
    } catch (error) {
      // Handle unique constraint violation
      if (error.code === '23505') {
        return res.status(409).json({
          success: false,
          message: `Attribute "${req.body.attribute_name}" already exists for this category.`
        });
      }
      next(error);
    }
  }

  /**
   * PUT /attributes/:attributeId
   * Update an attribute template.
   */
  async updateAttribute(req, res, next) {
    try {
      const { attributeId } = req.params;

      const old = await categoryAttributeModel.findById(attributeId);
      if (!old) {
        return res.status(404).json({ success: false, message: 'Attribute not found.' });
      }

      const {
        attribute_name,
        attribute_type,
        is_required,
        unit,
        allowed_values,
        display_order
      } = req.body;

      // Validate enum still has allowed_values
      const effectiveType = attribute_type || old.attribute_type;
      const effectiveAllowed = allowed_values !== undefined ? allowed_values : old.allowed_values;
      if (effectiveType === 'enum' && (!effectiveAllowed || effectiveAllowed.length === 0)) {
        return res.status(400).json({
          success: false,
          message: 'allowed_values must be provided for enum attributes.'
        });
      }

      const updated = await categoryAttributeModel.update(attributeId, {
        ...(attribute_name  !== undefined && { attribute_name }),
        ...(attribute_type  !== undefined && { attribute_type }),
        ...(is_required     !== undefined && { is_required }),
        ...(unit            !== undefined && { unit }),
        ...(allowed_values  !== undefined && { allowed_values }),
        ...(display_order   !== undefined && { display_order })
      });

      AuditService.log(req, 'attribute.updated', 'category_attribute', attributeId, {
        attribute_name: old.attribute_name,
        attribute_type: old.attribute_type,
        is_required:    old.is_required
      }, {
        attribute_name: updated.attribute_name,
        attribute_type: updated.attribute_type,
        is_required:    updated.is_required
      });

      res.status(200).json({ success: true, data: { attribute: updated } });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /attributes/:attributeId
   * Remove an attribute template. Cascades to product_attributes.
   */
  async deleteAttribute(req, res, next) {
    try {
      const { attributeId } = req.params;

      const existing = await categoryAttributeModel.findById(attributeId);
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Attribute not found.' });
      }

      await categoryAttributeModel.delete(attributeId);
      AuditService.log(req, 'attribute.deleted', 'category_attribute', attributeId);

      res.status(200).json({ success: true, message: 'Attribute deleted. Product values have been removed.' });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AttributeController();
