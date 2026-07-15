const express = require('express');
const router = express.Router();
const { protect, optionalAuth } = require('../middlewares/auth.middleware');
const qaController = require('../controllers/qa.controller');
const joi = require('joi');

const validateRequest = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({ success: false, error: error.details[0].message });
  }
  next();
};

const askSchema = joi.object({
  productId: joi.string().uuid().required(),
  question: joi.string().min(3).max(1000).required()
});

/**
 * @swagger
 * tags:
 *   name: Product Q&A
 *   description: Customer questions about products
 */

/**
 * @swagger
 * /qa/product/{productId}:
 *   get:
 *     summary: Get answered questions for a product (public)
 *     tags: [Product Q&A]
 */
router.get('/product/:productId', optionalAuth, qaController.getProductQuestions);

router.use(protect);

/**
 * @swagger
 * /qa:
 *   post:
 *     summary: Ask a question about a product
 *     tags: [Product Q&A]
 *     security:
 *       - bearerAuth: []
 */
router.post('/', validateRequest(askSchema), qaController.askQuestion);

module.exports = router;
