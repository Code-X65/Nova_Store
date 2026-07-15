const express = require('express');
const router = express.Router();
const adminCampaignController = require('../../controllers/admin/campaign.admin.controller');
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

const createSchema = joi.object({
  name: joi.string().required(),
  description: joi.string().optional().allow(''),
  discount_type: joi.string().valid('percentage', 'fixed').required(),
  discount_value: joi.number().positive().required(),
  scope: joi.string().valid('all_products', 'category', 'brand', 'products').default('all_products'),
  starts_at: joi.date().iso().required(),
  ends_at: joi.date().iso().required(),
  is_active: joi.boolean().optional(),
  product_ids: joi.array().items(joi.string().guid()).optional(),
  category_ids: joi.array().items(joi.string().guid()).optional(),
  brand_ids: joi.array().items(joi.string().guid()).optional()
});

const updateSchema = createSchema.fork(Object.keys(createSchema.describe().keys), (schema) => schema.optional());

router.use(requireAdmin);

/**
 * @swagger
 * tags:
 *   name: Admin Campaigns
 *   description: Admin management of marketing campaigns / flash sales
 */

/**
 * @swagger
 * /admin/campaigns:
 *   get:
 *     summary: List all campaigns (with filtering)
 *     tags: [Admin Campaigns]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Paginated list of campaigns
 *   post:
 *     summary: Create a new campaign
 *     tags: [Admin Campaigns]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Campaign created
 */
router.get('/', hasPermission('marketing:read'), adminCampaignController.getAllCampaigns);
router.post('/', hasPermission('marketing:write'), validateRequest(createSchema), adminCampaignController.createCampaign);

/**
 * @swagger
 * /admin/campaigns/{id}:
 *   get:
 *     summary: Get campaign details
 *     tags: [Admin Campaigns]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Campaign details
 *   patch:
 *     summary: Update a campaign
 *     tags: [Admin Campaigns]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Updated campaign
 *   delete:
 *     summary: Delete a campaign
 *     tags: [Admin Campaigns]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Campaign deleted
 */
router.get('/:id', hasPermission('marketing:read'), adminCampaignController.getCampaignById);
router.patch('/:id', hasPermission('marketing:write'), validateRequest(updateSchema), adminCampaignController.updateCampaign);
router.delete('/:id', hasPermission('marketing:write'), adminCampaignController.deleteCampaign);

module.exports = router;
