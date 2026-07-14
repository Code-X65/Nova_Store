const express = require('express');
const { ImportController, upload } = require('../../controllers/admin/import.controller');
const { protect } = require('../../middlewares/auth.middleware');
const { hasPermission } = require('../../middlewares/permission.middleware');
const Joi = require('joi');
const validate = require('../../middlewares/validate.middleware');

const router = express.Router();

const entityTypeSchema = {
  body: Joi.object({
    entityType: Joi.string().valid('product', 'variant', 'inventory', 'category').required(),
  })
};

// /api/v1/admin is already guarded by requireAdmin in app.js
router.use(protect);

router.post('/', upload.single('file'), validate(entityTypeSchema), ImportController.upload);
router.get('/:id', hasPermission('inventory:read'), ImportController.getStatus);
router.get('/:id/errors', hasPermission('inventory:read'), ImportController.getErrors);

module.exports = router;
