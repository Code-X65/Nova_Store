const express = require('express');
const productController = require('../controllers/product.controller');
const { protect, optionalAuth } = require('../middlewares/auth.middleware');
const { hasPermission } = require('../middlewares/permission.middleware');
const validate = require('../middlewares/validate.middleware');
const Joi = require('joi');
const scopeToStore = require('../middlewares/scope-to-store.middleware');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Products
 *   description: Product and catalog management
 * 
 * components:
 *   schemas:
 *     Product:
 *       type: object
 *       required:
 *         - sku
 *         - name
 *         - category_id
 *         - price
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         sku:
 *           type: string
 *           example: ELEC-001
 *         name:
 *           type: string
 *           example: Wireless Earbuds Pro
 *         description:
 *           type: string
 *           example: Premium noise-cancelling earbuds.
 *         short_description:
 *           type: string
 *           example: High-quality earbuds.
 *         category:
 *           type: string
 *           example: electronics
 *         category_id:
 *           type: string
 *           format: uuid
 *           example: a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
 *         subcategory_id:
 *           type: string
 *           format: uuid
 *           nullable: true
 *           example: a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12
 *         brand:
 *           type: string
 *           example: SoundMax
 *         price:
 *           type: number
 *           example: 199.99
 *         sale_price:
 *           type: number
 *           example: 149.99
 *         stock_quantity:
 *           type: integer
 *           example: 50
 *         primary_image_url:
 *           type: string
 *           format: uri
 *           description: Full-resolution hero/cover image URL
 *         thumbnail_url:
 *           type: string
 *           format: uri
 *           description: Small/optimised image URL for product listing cards
 *         image_gallery:
 *           type: array
 *           items:
 *             type: string
 *         currency:
 *           type: string
 *           example: USD
 *           description: ISO-4217 currency code for product pricing (e.g. USD, NGN, GBP)
 *           default: USD
 *         status:
 *           type: string
 *           enum: [draft, published, archived]
 *           default: draft
 *         is_featured:
 *           type: boolean
 *           default: false
 *         color:
 *           type: string
 *           nullable: true
 *           example: "#1A73E8"
 *           description: Primary product color (free-text — hex, name, or CSS value)
 *         weight:
 *           type: number
 *           nullable: true
 *           example: 0.25
 *           description: Product weight in kilograms (used for shipping calculations)
 *         dimensions_length:
 *           type: number
 *           nullable: true
 *           example: 15.0
 *           description: Box length in centimetres
 *         dimensions_width:
 *           type: number
 *           nullable: true
 *           example: 8.0
 *           description: Box width in centimetres
 *         dimensions_height:
 *           type: number
 *           nullable: true
 *           example: 3.5
 *           description: Box height in centimetres
 *         cost_price:
 *           type: number
 *           nullable: true
 *           example: 89.99
 *           description: Internal cost price for profit-margin analytics (not exposed to customers)
 *         allow_backorder:
 *           type: boolean
 *           default: false
 *           description: Allow purchases even when stock_quantity reaches zero
 *         track_inventory:
 *           type: boolean
 *           default: true
 *           description: Enable stock-quantity tracking for this product
 *         tags:
 *           type: array
 *           items:
 *             type: string
 *           example: ["wireless", "noise-cancelling"]
 *           description: Searchable tags for discovery
 *         meta_title:
 *           type: string
 *           nullable: true
 *           example: "Wireless Earbuds Pro | SoundMax"
 *           description: SEO title tag (max 60 chars)
 *         meta_description:
 *           type: string
 *           nullable: true
 *           example: "Shop the best noise-cancelling earbuds."
 *           description: SEO meta description (max 160 chars)
 *         meta_keywords:
 *           type: array
 *           items:
 *             type: string
 *           description: SEO keywords
 *         variants:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               sku:
 *                 type: string
 *               name:
 *                 type: string
 *               option_values:
 *                 type: object
 *               stock_quantity:
 *                 type: integer
 *     ProductUpdate:
 *       type: object
 *       properties:
 *         sku:
 *           type: string
 *         name:
 *           type: string
 *         description:
 *           type: string
 *         short_description:
 *           type: string
 *         category_id:
 *           type: string
 *           format: uuid
 *         subcategory_id:
 *           type: string
 *           format: uuid
 *           nullable: true
 *         brand:
 *           type: string
 *         price:
 *           type: number
 *         sale_price:
 *           type: number
 *         stock_quantity:
 *           type: integer
 *         status:
 *           type: string
 *           enum: [draft, published, archived]
 *         is_featured:
 *           type: boolean
 *         primary_image_url:
 *           type: string
 *           format: uri
 *         thumbnail_url:
 *           type: string
 *           format: uri
 *           description: Small/optimised listing thumbnail (replaces old value)
 *         currency:
 *           type: string
 *           description: ISO-4217 currency code
 *         color:
 *           type: string
 *           nullable: true
 *         weight:
 *           type: number
 *           nullable: true
 *         dimensions_length:
 *           type: number
 *           nullable: true
 *         dimensions_width:
 *           type: number
 *           nullable: true
 *         dimensions_height:
 *           type: number
 *           nullable: true
 *         cost_price:
 *           type: number
 *           nullable: true
 *         allow_backorder:
 *           type: boolean
 *         track_inventory:
 *           type: boolean
 *         tags:
 *           type: array
 *           items:
 *             type: string
 *         meta_title:
 *           type: string
 *           nullable: true
 *         meta_description:
 *           type: string
 *           nullable: true
 *         meta_keywords:
 *           type: array
 *           items:
 *             type: string
 */

// --- Validation Schemas ---

const productSchema = {
  body: Joi.object({
    sku:               Joi.string().optional().allow(null, ''),
    name:              Joi.string().min(2).max(200).required().example('Wireless Earbuds Pro'),
    description:       Joi.string().min(50).max(2000).optional().allow('', null).example('Premium noise-cancelling earbuds with long battery life.'),
    short_description: Joi.string().min(10).max(200).optional().allow('', null).example('High-quality earbuds.'),
    category:          Joi.string().optional().example('electronics'),
    category_id:       Joi.string().uuid().required().example('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'),
    subcategory_id:    Joi.string().uuid().optional().allow(null),
    brand:             Joi.string().optional().allow('', null).example('SoundMax'),
    brand_id:          Joi.string().uuid().optional().allow(null),
    price:             Joi.number().positive().required().example(199.99),
    cost_price:        Joi.number().positive().optional().allow(null).example(89.99),
    status:            Joi.string().valid('draft', 'published', 'archived').default('draft'),
    is_featured:       Joi.boolean().default(false),
    primary_image_url: Joi.string().uri().optional().allow(null, ''),
    thumbnail_url:     Joi.string().uri().optional().allow(null, ''),
    image_gallery:     Joi.array().items(Joi.string().uri()).max(5).when('status', {
      is: 'published',
      then: Joi.array().min(2).required(),
      otherwise: Joi.array().optional()
    }),
    currency:          Joi.string().length(3).uppercase().default('USD'),
    // Physical attributes (for shipping)
    color:             Joi.string().max(50).optional().allow(null, '').example('#1A73E8'),
    weight:            Joi.number().positive().optional().allow(null).example(0.25),
    dimensions_length: Joi.number().positive().optional().allow(null).example(15.0),
    dimensions_width:  Joi.number().positive().optional().allow(null).example(8.0),
    dimensions_height: Joi.number().positive().optional().allow(null).example(3.5),
    // Discovery
    tags:              Joi.array().items(Joi.string()).max(20).optional(),
    // SEO
    meta_title:        Joi.string().max(60).optional().allow(null, ''),
    meta_description:  Joi.string().max(160).optional().allow(null, ''),
    meta_keywords:     Joi.array().items(Joi.string()).optional(),
    variants: Joi.array().items(Joi.object({
      sku:           Joi.string().optional().allow(null, ''),
      name:          Joi.string().required(),
      option_values: Joi.object().required(),
      stock_quantity:Joi.number().integer().min(0)
    })),
    // Dynamic category-specific attributes: { "RAM": "8GB", "Storage": "256GB" }
    attributes: Joi.object().pattern(Joi.string(), Joi.alternatives().try(
      Joi.string(), Joi.number(), Joi.boolean()
    )).optional(),
    related_product_ids: Joi.array().items(Joi.string().uuid()).optional()
  })
};

const bulkProductSchema = {
  body: Joi.object({
    products: Joi.array().items(
      Joi.object({
        sku:               Joi.string().optional().allow(null, ''),
        name:              Joi.string().min(2).max(200).required(),
        description:       Joi.string().min(50).max(2000).optional().allow('', null),
        short_description: Joi.string().min(10).max(200).optional().allow('', null),
        category_id:       Joi.string().uuid().required(),
        subcategory_id:    Joi.string().uuid().optional().allow(null),
        brand_id:          Joi.string().uuid().optional().allow(null),
        price:             Joi.number().positive().required(),
        cost_price:        Joi.number().positive().optional().allow(null),
        status:            Joi.string().valid('draft', 'published', 'archived').default('draft'),
        is_featured:       Joi.boolean().default(false),
        primary_image_url: Joi.string().uri().optional().allow(null, ''),
        thumbnail_url:     Joi.string().uri().optional().allow(null, ''),
        image_gallery:     Joi.array().items(Joi.string().uri()).max(5).when('status', {
          is: 'published',
          then: Joi.array().min(2).required(),
          otherwise: Joi.array().optional()
        }),
        currency:          Joi.string().length(3).uppercase().default('USD'),
        color:             Joi.string().max(50).optional().allow(null, ''),
        weight:            Joi.number().positive().optional().allow(null),
        dimensions_length: Joi.number().positive().optional().allow(null),
        dimensions_width:  Joi.number().positive().optional().allow(null),
        dimensions_height: Joi.number().positive().optional().allow(null),
        tags:              Joi.array().items(Joi.string()).max(20).optional(),
        meta_title:        Joi.string().max(60).optional().allow(null, ''),
        meta_description:  Joi.string().max(160).optional().allow(null, ''),
        meta_keywords:     Joi.array().items(Joi.string()).optional(),
        variants: Joi.array().items(Joi.object({
          sku:           Joi.string().optional().allow(null, ''),
          name:          Joi.string().required(),
          option_values: Joi.object().required(),
          stock_quantity:Joi.number().integer().min(0)
        })),
        attributes: Joi.object().pattern(Joi.string(), Joi.alternatives().try(
          Joi.string(), Joi.number(), Joi.boolean()
        )).optional()
      })
    ).min(1).max(500).required()
  })
};

const productUpdateSchema = {
  body: Joi.object({
    sku:               Joi.string().optional().allow(null, ''),
    name:              Joi.string().min(2).max(200).optional(),
    description:       Joi.string().min(50).max(2000).optional().allow('', null),
    short_description: Joi.string().min(10).max(200).optional().allow('', null),
    category:          Joi.string().optional(),
    category_id:       Joi.string().uuid().optional(),
    subcategory_id:    Joi.string().uuid().optional().allow(null),
    brand:             Joi.string().optional().allow('', null),
    brand_id:          Joi.string().uuid().optional().allow(null),
    price:             Joi.number().positive().optional(),
    cost_price:        Joi.number().positive().optional().allow(null),
    status:            Joi.string().valid('draft', 'published', 'archived', 'out_of_stock').optional(),
    is_featured:       Joi.boolean().optional(),
    primary_image_url: Joi.string().uri().optional().allow(null, ''),
    thumbnail_url:     Joi.string().uri().optional().allow(null, ''),
    image_gallery:     Joi.array().items(Joi.string().uri()).max(5).optional(), // validation for min(2) when published happens in service for partial updates
    currency:          Joi.string().length(3).uppercase().optional(),
    // Physical attributes (for shipping)
    color:             Joi.string().max(50).optional().allow(null, ''),
    weight:            Joi.number().positive().optional().allow(null),
    dimensions_length: Joi.number().positive().optional().allow(null),
    dimensions_width:  Joi.number().positive().optional().allow(null),
    dimensions_height: Joi.number().positive().optional().allow(null),
    // Discovery
    tags:              Joi.array().items(Joi.string()).max(20).optional(),
    // SEO
    meta_title:        Joi.string().max(60).optional().allow(null, ''),
    meta_description:  Joi.string().max(160).optional().allow(null, ''),
    meta_keywords:     Joi.array().items(Joi.string()).optional(),
    // Dynamic category-specific attributes (partial update: only submitted keys are saved)
    attributes: Joi.object().pattern(Joi.string(), Joi.alternatives().try(
      Joi.string(), Joi.number(), Joi.boolean()
    )).optional()
  }).min(1)
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
router.get('/', optionalAuth, productController.getAllProducts);
router.post('/', protect, hasPermission('product:create'), scopeToStore, validate(productSchema), productController.createProduct);

/**
 * @swagger
 * /products/bulk:
 *   post:
 *     summary: Create multiple products at once (Admin only)
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [products]
 *             properties:
 *               products:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/Product'
 *     responses:
 *       201:
 *         description: Products created successfully
 */
router.post('/bulk', protect, hasPermission('product:create'), scopeToStore, validate(bulkProductSchema), productController.createBulkProducts);

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

const recommendationController = require('../controllers/recommendation.controller');

/**
 * @swagger
 * /products/recommendations:
 *   get:
 *     summary: Get personalized product recommendations
 *     tags: [Products]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *         description: Maximum number of recommendations to return
 *     responses:
 *       200:
 *         description: Ranked recommendation list returned successfully
 */
router.get('/recommendations', recommendationController.getRecommendations);

/**
 * @swagger
 * /products/search:
 *   get:
 *     summary: Search products using natural language full-text search
 *     tags: [Products]
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema: { type: string }
 *         description: The text search query (e.g., 'gaming headphones')
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *         description: Maximum number of products to return
 *     responses:
 *       200:
 *         description: Ranked search results returned successfully
 */
router.get('/search', productController.search);
router.get('/price-range', productController.getPriceRange);

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

router.patch('/:id', protect, hasPermission('product:write'), scopeToStore, validate(productUpdateSchema), productController.updateProduct);
router.delete('/:id', protect, hasPermission('product:delete'), scopeToStore, productController.deleteProduct);

// Image Gallery Sub-resource Routes

/**
 * @swagger
 * /products/{id}/images:
 *   post:
 *     summary: Add an image to product image gallery (Admin only)
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [imageUrl]
 *             properties:
 *               imageUrl: { type: string, format: uri }
 *     responses:
 *       200:
 *         description: Image added successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Product not found
 */
router.post('/:id/images', protect, hasPermission('product:write'), scopeToStore, productController.addProductImage);

/**
 * @swagger
 * /products/{id}/images/{index}:
 *   delete:
 *     summary: Remove an image from product image gallery by index (Admin only)
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: index
 *         required: true
 *         schema: { type: integer }
 *         description: Array index of the image to remove
 *     responses:
 *       200:
 *         description: Image removed successfully
 *       400:
 *         description: Invalid index or path parameters
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Product not found
 */
router.delete('/:id/images/:index', protect, hasPermission('product:write'), scopeToStore, productController.removeProductImage);

// Product Variant Sub-resource Routes

/**
 * @swagger
 * /products/{id}/variants/{variantId}:
 *   put:
 *     summary: Update an existing product variant (Admin only)
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: variantId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               sku: { type: string }
 *               name: { type: string }
 *               option_values: { type: object }
 *               stock_quantity: { type: integer, minimum: 0 }
 *     responses:
 *       200:
 *         description: Variant updated successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Variant not found
 *   delete:
 *     summary: Delete a product variant (Admin only)
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: variantId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Variant deleted successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Variant not found
 *   post:
 *     summary: Add a new variant to an existing product (Admin only)
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               sku: { type: string }
 *               name: { type: string }
 *               option_values: { type: object }
 *               stock_quantity: { type: integer, minimum: 0 }
 *     responses:
 *       201:
 *         description: Variant added successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Product not found
 */
router.post('/:id/variants', protect, hasPermission('product:write'), scopeToStore, productController.addProductVariant);
router.put('/:id/variants/:variantId', protect, hasPermission('product:write'), scopeToStore, productController.updateProductVariant);
router.delete('/:id/variants/:variantId', protect, hasPermission('product:delete'), scopeToStore, productController.deleteProductVariant);

// Related Products Routes

/**
 * @swagger
 * /products/{id}/related:
 *   get:
 *     summary: Get related products for a specific product
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: List of related products
 *   post:
 *     summary: Add a manually related product (Admin only)
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [relatedProductId]
 *             properties:
 *               relatedProductId: { type: string, format: uuid }
 *     responses:
 *       201:
 *         description: Related product linked
 */
router.get('/:id/related', productController.getRelatedProducts);
router.post('/:id/related', protect, hasPermission('product:write'), scopeToStore, productController.addRelatedProduct);

/**
 * @swagger
 * /products/{id}/related/{relatedId}:
 *   delete:
 *     summary: Remove a manually related product link (Admin only)
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: relatedId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Related product unlinked
 */
router.delete('/:id/related/:relatedId', protect, hasPermission('product:write'), scopeToStore, productController.removeRelatedProduct);


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
