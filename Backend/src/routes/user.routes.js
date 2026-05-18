const express = require('express');
const userController = require('../controllers/user.controller');
const addressController = require('../controllers/address.controller');
const addressModel = require('../models/address.model');
const { protect } = require('../middlewares/auth.middleware');
const authorizeResource = require('../middlewares/ownership.middleware');
const upload = require('../middlewares/upload.middleware');
const validate = require('../middlewares/validate.middleware');
const Joi = require('joi');

const router = express.Router();

// All routes here require authentication
router.use(protect);

/**
 * @swagger
 * tags:
 *   name: User
 *   description: User profile and address management
 */

// --- Validation Schemas ---

const profileUpdateSchema = {
  body: Joi.object({
    first_name: Joi.string().min(2).max(50),
    last_name: Joi.string().min(2).max(50),
    phone_number: Joi.string().pattern(/^[+]*[(]{0,1}[0-9]{1,4}[)]{0,1}[-\s\./0-9]*$/),
    date_of_birth: Joi.date().iso().max('now'),
    bio: Joi.string().max(500),
    preferences: Joi.object()
  })
};

const emailChangeRequestSchema = {
  body: Joi.object({
    newEmail: Joi.string().email().required()
  })
};

const emailChangeVerifySchema = {
  body: Joi.object({
    token: Joi.string().required(),
    newEmail: Joi.string().email().required()
  })
};

const addressSchema = {
  body: Joi.object({
    title: Joi.string().required().example('Home'),
    receiver_name: Joi.string().required(),
    phone_number: Joi.string().required(),
    street_address: Joi.string().required(),
    apartment: Joi.string().allow('', null),
    city: Joi.string().required(),
    state: Joi.string().required(),
    postal_code: Joi.string().required(),
    country: Joi.string().default('Nigeria'),
    is_default: Joi.boolean().default(false)
  })
};

const addressIdSchema = {
  params: Joi.object({
    id: Joi.string().guid({ version: 'uuidv4' }).required()
  })
};

// --- Profile Routes ---

/**
 * @swagger
 * /user/profile:
 *   get:
 *     summary: Get current user profile
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile retrieved successfully
 *   patch:
 *     summary: Update user profile
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ProfileUpdate'
 *     responses:
 *       200:
 *         description: Profile updated successfully
 */
router.get('/profile', userController.getProfile);
router.patch('/profile', validate(profileUpdateSchema), userController.updateProfile);

/**
 * @swagger
 * /user/email/request:
 *   post:
 *     summary: Request email change
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [newEmail]
 *             properties:
 *               newEmail: { type: string, format: email }
 *     responses:
 *       200:
 *         description: Verification email sent to new address
 */
router.post('/email/request', validate(emailChangeRequestSchema), userController.requestEmailChange);

/**
 * @swagger
 * /user/email/verify:
 *   post:
 *     summary: Verify and complete email change
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, newEmail]
 *             properties:
 *               token: { type: string }
 *               newEmail: { type: string, format: email }
 *     responses:
 *       200:
 *         description: Email changed successfully
 */
router.post('/email/verify', validate(emailChangeVerifySchema), userController.verifyEmailChange);

/**
 * @swagger
 * /user/avatar:
 *   post:
 *     summary: Upload user avatar (Sharp optimized)
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               avatar:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Avatar uploaded successfully (WebP format)
 *   delete:
 *     summary: Delete user avatar
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Avatar deleted successfully
 */
router.post('/avatar', upload.single('avatar'), userController.uploadAvatar);
router.delete('/avatar', userController.deleteAvatar);

/**
 * @swagger
 * /user/account:
 *   delete:
 *     summary: Soft-delete user account
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Account deactivated and anonymized
 */
router.delete('/account', userController.deleteAccount);

// --- Address Routes ---

/**
 * @swagger
 * /user/addresses:
 *   get:
 *     summary: List all saved addresses
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of addresses retrieved
 *   post:
 *     summary: Add a new address
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, receiver_name, phone_number, street_address, city, state, postal_code]
 *             properties:
 *               title: { type: string }
 *               receiver_name: { type: string }
 *               phone_number: { type: string }
 *               street_address: { type: string }
 *               apartment: { type: string }
 *               city: { type: string }
 *               state: { type: string }
 *               postal_code: { type: string }
 *               country: { type: string }
 *               is_default: { type: boolean }
 *     responses:
 *       201:
 *         description: Address created successfully
 */
router.get('/addresses', addressController.getAddresses);
router.post('/addresses', validate(addressSchema), addressController.addAddress);

/**
 * @swagger
 * /user/addresses/{id}:
 *   get:
 *     summary: Get a specific address
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Address details
 *   patch:
 *     summary: Update an address (Owner only)
 *     tags: [User]
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
 *             type: object
 *             properties:
 *               title: { type: string }
 *               is_default: { type: boolean }
 *     responses:
 *       200:
 *         description: Address updated successfully
 *   delete:
 *     summary: Delete an address (Owner only)
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Address deleted successfully
 */
router.get('/addresses/:id', validate(addressIdSchema), authorizeResource(addressModel), addressController.getAddressById);
router.patch('/addresses/:id', validate(addressIdSchema), authorizeResource(addressModel), addressController.updateAddress);
router.delete('/addresses/:id', validate(addressIdSchema), authorizeResource(addressModel), addressController.deleteAddress);

/**
 * @swagger
 * /user/addresses/{id}/default:
 *   patch:
 *     summary: Set an address as default (Owner only)
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Default address updated
 */
router.patch('/addresses/:id/default', validate(addressIdSchema), authorizeResource(addressModel), addressController.setAddressAsDefault);

module.exports = router;
