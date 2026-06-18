/**
 * Return Evidence Upload Route
 * POST /api/v1/orders/:id/return-evidence
 *
 * Accepts up to 5 image files (jpg, jpeg, png, webp) per request.
 * Uploads them to the Supabase Storage bucket defined by SUPABASE_RETURN_EVIDENCE_BUCKET
 * (defaults to "return-evidence") and returns the public URLs.
 *
 * The returned URLs should then be passed to POST /orders/:id/return-request
 * as evidenceUrls[] when submitting the actual return request.
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const { supabaseAdmin } = require('../config/supabase');
const { protect } = require('../middlewares/auth.middleware');
const OrderModel = require('../models/order.model');
const logger = require('../utils/logger');

const router = express.Router({ mergeParams: true }); // mergeParams exposes :id from parent

const BUCKET = process.env.SUPABASE_RETURN_EVIDENCE_BUCKET || 'return-evidence';
const MAX_FILES = 5;
const ALLOWED_MIME = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB per file

// Use memory storage so we can stream directly to Supabase Storage
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files (jpg, png, webp) are allowed for return evidence'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: MAX_FILES
  }
});

/**
 * @swagger
 * /orders/{id}/return-evidence:
 *   post:
 *     summary: Upload return evidence photos (up to 5 images, max 5MB each)
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Order ID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               files:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 maxItems: 5
 *     responses:
 *       200:
 *         description: Evidence uploaded; returns array of public URLs
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     urls:
 *                       type: array
 *                       items: { type: string, format: uri }
 */
router.post('/',
  protect,
  upload.array('files', MAX_FILES),
  async (req, res, next) => {
    try {
      const orderId = req.params.id;

      // Validate order ownership
      const order = await OrderModel.findById(orderId);
      if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
      if (order.user_id !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Unauthorized' });
      }

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ success: false, message: 'No files uploaded' });
      }

      const uploadedUrls = [];

      for (const file of req.files) {
        const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
        const filename = `${orderId}/${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;

        const { error: uploadError } = await supabaseAdmin.storage
          .from(BUCKET)
          .upload(filename, file.buffer, {
            contentType: file.mimetype,
            upsert: false
          });

        if (uploadError) {
          logger.error(`[ReturnEvidence] Upload failed for file ${file.originalname}:`, uploadError.message);
          throw new Error(`Failed to upload ${file.originalname}: ${uploadError.message}`);
        }

        const { data: publicData } = supabaseAdmin.storage
          .from(BUCKET)
          .getPublicUrl(filename);

        uploadedUrls.push(publicData.publicUrl);
      }

      res.status(200).json({
        success: true,
        data: { urls: uploadedUrls },
        message: `${uploadedUrls.length} file(s) uploaded. Pass these URLs as evidenceUrls when submitting your return request.`
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
