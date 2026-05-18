const express = require('express');
const productController = require('../controllers/product.controller');
const { protect } = require('../middlewares/auth.middleware');
const { hasPermission } = require('../middlewares/permission.middleware');
const validate = require('../middlewares/validate.middleware');
const Joi = require('joi');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Products
 *   description: Product and catalog management
 */

// --- Validation Schemas ---

const productSchema = {
  body: Joi.object({
    sku: Joi.string().required().example('ELEC-001'),
    name: Joi.string().min(2).max(200).required().example('Wireless Earbuds Pro'),
    description: Joi.string().example('Premium noise-cancelling earbuds with long battery life.'),
    short_description: Joi.string().example('High-quality earbuds.'),
    category: Joi.string().required().example('electronics'),
    brand: Joi.string().example('SoundMax'),
    price: Joi.number().positive().required().example(199.99),
    sale_price: Joi.number().positive().allow(null).example(149.99),
    stock_quantity: Joi.number().integer().min(0).default(0),
    status: Joi.string().valid('draft', 'published', 'archived').default('draft'),
    is_featured: Joi.boolean().default(false),
    variants: Joi.array().items(Joi.object({
      sku: Joi.string().required(),
      name: Joi.string().required(),
      option_values: Joi.object().required(),
      stock_quantity: Joi.number().integer().min(0)
    }))
  })
};

// --- Routes ---

/**
 * @swagger
 * /products:
 *   get:
 *     summary: List all products with advanced filtering and search
 *     tags: [Products]
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Search by name, description, or SKU
 *       - in: query
 *         name: category
 *         schema: { type: string }
 *       - in: query
 *         name: brand
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [published, draft, archived] }
 *         description: Admins can see all; customers see published only
 *       - in: query
 *         name: minPrice
 *         schema: { type: number }
 *       - in: query
 *         name: maxPrice
 *         schema: { type: number }
 *       - in: query
 *         name: minRating
 *         schema: { type: number, minimum: 0, maximum: 5 }
 *       - in: query
 *         name: sortBy
 *         schema: { type: string, enum: [newest, cheapest, popular, price_low, price_high, rating], default: newest }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Paginated list of products
 *   post:
 *     summary: Create a new product with optional variants (Admin only)
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Product'
 *     responses:
 *       201:
 *         description: Product created successfully
 */
router.get('/', productController.getAllProducts);
router.post('/', protect, hasPermission('product:create'), validate(productSchema), productController.createProduct);

/**
 * @swagger
 * /products/featured:
 *   get:
 *     summary: Retrieve featured products for homepage
 *     tags: [Products]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *     responses:
 *       200:
 *         description: List of featured products
 */
router.get('/featured', productController.getFeaturedProducts);

/**
 * @swagger
 * /products/{id}:
 *   get:
 *     summary: Get detailed product information including variants
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Detailed product object
 *   patch:
 *     summary: Update an existing product (Admin only)
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ProductUpdate'
 *     responses:
 *       200:
 *         description: Product updated successfully
 *   delete:
 *     summary: Soft delete (archive) a product (Admin only)
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Product moved to archive
 */
router.get('/:id', productController.getProductById);

/**
 * @swagger
 * /products/{id}/stock:
 *   get:
 *     summary: Check stock availability for a specific product
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Stock information
 *       404:
 *         description: Product not found
 */
router.get('/:id/stock', productController.checkStock);

router.patch('/:id', protect, hasPermission('product:write'), productController.updateProduct);
router.delete('/:id', protect, hasPermission('product:delete'), productController.deleteProduct);

/**
 * @swagger
 * /products/slug/{slug}:
 *   get:
 *     summary: Get product by its SEO-friendly slug
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Product details
 */
router.get('/slug/:slug', productController.getProductBySlug);

module.exports = router;
