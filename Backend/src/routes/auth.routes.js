const express = require('express');
const Joi = require('joi');
const authController = require('../controllers/auth.controller');
const validate = require('../middlewares/validate.middleware');
const { protect } = require('../middlewares/auth.middleware');
const { hasPermission } = require('../middlewares/permission.middleware');
const AuditService = require('../services/audit.service');

const router = express.Router();

const resendVerificationSchema = {
  body: Joi.object({
    email: Joi.string().email().required()
  })
};

const registerSchema = {
  body: Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required'
    }),
    password: Joi.string()
      .min(12)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,}$/)
      .required()
      .messages({
        'string.min': 'Password must be at least 12 characters long',
        'string.pattern.base': 'Password must contain at least one lowercase letter, one uppercase letter, one number and one special character',
        'any.required': 'Password is required'
      }),
    confirmPassword: Joi.string()
      .valid(Joi.ref('password'))
      .required()
      .messages({ 'any.only': 'Passwords do not match' }),
    firstName: Joi.string().min(2).max(50).required(),
    lastName: Joi.string().min(2).max(50).required(),
    phoneNumber: Joi.string().pattern(/^\+?\d{7,15}$/).required(),
    phoneCountryCode: Joi.string().pattern(/^\+?\d{1,4}$/).required(),
    homeAddress: Joi.object({
      street: Joi.string().max(200).required(),
      city: Joi.string().max(100).required(),
      state: Joi.string().max(100).required(),
      postalCode: Joi.string().max(20).required(),
      country: Joi.string().max(100).required()
    }).required(),
    referralSource: Joi.string().valid('facebook','instagram','twitter','tiktok','friend','colleague','google','other').optional(),
    referredByCode: Joi.string().alphanum().length(12).optional()
  })
};

const loginSchema = {
  body: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  })
};

const adminRegisterSchema = {
  body: Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required'
    }),
    password: Joi.string()
      .min(12)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,}$/)
      .required()
      .messages({
        'string.min': 'Password must be at least 12 characters long',
        'string.pattern.base': 'Password must contain at least one lowercase letter, one uppercase letter, one number and one special character',
        'any.required': 'Password is required'
      }),
    confirmPassword: Joi.string()
      .valid(Joi.ref('password'))
      .required()
      .messages({ 'any.only': 'Passwords do not match' }),
    firstName: Joi.string().min(2).max(50).required(),
    lastName: Joi.string().min(2).max(50).required(),
    phoneNumber: Joi.string().pattern(/^\+?\d{7,15}$/).required(),
    phoneCountryCode: Joi.string().pattern(/^\+?\d{1,4}$/).required(),
    homeAddress: Joi.object({
      street: Joi.string().max(200).required(),
      city: Joi.string().max(100).required(),
      state: Joi.string().max(100).required(),
      postalCode: Joi.string().max(20).required(),
      country: Joi.string().max(100).required()
    }).required(),
    department: Joi.string().max(100).required(),
    accessLevel: Joi.string().valid('super_admin', 'admin', 'staff').default('admin')
  })
};

const changePasswordSchema = {
  body: Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: Joi.string()
      .min(12)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,}$/)
      .required()
  })
};

const forgotPasswordSchema = {
  body: Joi.object({
    email: Joi.string().email().required()
  })
};

const resetPasswordSchema = {
  body: Joi.object({
    token: Joi.string().required(),
    newPassword: Joi.string()
      .min(12)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,}$/)
      .required()
  })
};

const sendPhoneOtpSchema = {
  body: Joi.object({
    userId: Joi.string().guid({ version: 'uuidv4' }).required(),
    phoneNumber: Joi.string().pattern(/^\+?\d{7,15}$/).required(),
    phoneCountryCode: Joi.string().pattern(/^\+?\d{1,4}$/).required()
  })
};

const verifyPhoneSchema = {
  body: Joi.object({
    userId: Joi.string().guid({ version: 'uuidv4' }).required(),
    otp: Joi.string().length(6).pattern(/^\d{6}$/).required()
  })
};

/**
 * @swagger
 * tags:
 *   name: Authentication
 *   description: User management and authentication
 */

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
*               - password
*               - confirmPassword
*               - firstName
*               - lastName
*               - phoneNumber
*               - phoneCountryCode
*               - homeAddress
*             properties:
*               email:
*                 type: string
*                 format: email
*                 example: user@example.com
*               password:
*                 type: string
*                 format: password
*                 example: SecurePass123!
*                 description: Must be 12+ chars, include upper, lower, number, and special char.
*               confirmPassword:
*                 type: string
*                 format: password
*                 example: SecurePass123!
*               firstName:
*                 type: string
*                 example: John
*               lastName:
*                 type: string
*                 example: Doe
*               phoneNumber:
*                 type: string
*                 example: +234801234567
*               phoneCountryCode:
*                 type: string
*                 example: +234
*               homeAddress:
*                 type: object
*                 properties:
*                   street:
*                     type: string
*                   city:
*                     type: string
*                   state:
*                     type: string
*                   postalCode:
*                     type: string
*                   country:
*                     type: string
*               referralSource:
*                 type: string
*                 enum: [facebook, instagram, twitter, tiktok, friend, colleague, google, other]
*               referredByCode:
*                 type: string
*                 pattern: ^[A-Z0-9]{12}$
*                 example: NOVA-XYZ123
*     responses:
*       201:
*         description: Registration successful
*         content:
*           application/json:
*             schema:
*               type: object
*               properties:
*                 success:
*                   type: boolean
*                 message:
*                   type: string
*                 data:
*                   type: object
*                   properties:
*                     userId:
*                       type: string
*       400:
*         description: Validation error or Email already exists
*       409:
*         description: Email or phone number already registered
*       429:
*         description: Too many requests
*/
router.post('/register', validate(registerSchema), authController.register);

/**
 * @swagger
 * /auth/send-phone-otp:
 *   post:
 *     summary: Send OTP to phone number
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - phoneNumber
 *               - phoneCountryCode
 *             properties:
 *               userId:
 *                 type: string
*                 format: uuid
*               phoneNumber:
*                 type: string
*                 example: +234801234567
*               phoneCountryCode:
*                 type: string
*                 example: +234
*     responses:
*       200:
*         description: OTP sent successfully
*         content:
*           application/json:
*             schema:
*               type: object
*               properties:
*                 success:
*                   type: boolean
*                 message:
*                   type: string
*       400:
*         description: Validation error
*       500:
*         description: SMS provider error
*/
router.post('/send-phone-otp', validate(sendPhoneOtpSchema), authController.sendPhoneOtp);

/**
 * @swagger
 * /auth/verify-phone:
 *   post:
 *     summary: Verify phone OTP
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - otp
 *             properties:
 *               userId:
*                 type: string
*                 format: uuid
*               otp:
*                 type: string
*                 pattern: ^\d{6}$
*                 example: 123456
*     responses:
*       200:
*         description: Phone verified successfully
*         content:
*           application/json:
*             schema:
*               type: object
*               properties:
*                 success:
*                   type: boolean
*                 message:
*                   type: string
*                 data:
*                   type: object
*                   properties:
*                     isPhoneVerified:
*                       type: boolean
*       400:
*         description: Validation error or invalid/expired OTP
*       422:
*         description: Maximum OTP attempts exceeded
*/
router.post('/verify-phone', validate(verifyPhoneSchema), authController.verifyPhone);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 accessToken:
 *                   type: string
 *                 user:
 *                   type: object
 *                   properties:
 *                     id: { type: string }
 *                     email: { type: string }
 *                     isVerified: { type: boolean }
 *       401:
 *         description: Invalid credentials
 *       403:
 *         description: Account locked or unverified
 */
router.post('/login', validate(loginSchema), authController.login);

// NOTE: Admin login is now handled by POST /api/v1/admin/login (session-cookie based).
// The route below is intentionally removed.

// NOTE: Admin registration is permanently disabled.
// New admin accounts must be created via: node src/scripts/create-admin.js <email> <password>

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Logout user
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: Logged out successfully
 */
router.post('/logout', authController.logout);

/**
 * @swagger
 * /auth/oauth/google:
 *   get:
 *     summary: Initiate Google OAuth login
 *     description: |
 *       Redirects the user to Google's OAuth 2.0 consent screen. 
 *       **Note:** This endpoint should be opened directly in a browser window, not called via an AJAX/fetch request.
 *     tags: [Authentication]
 *     responses:
 *       302:
 *         description: Redirect to Google login page
 */
router.get('/oauth/google', authController.googleLogin);

/**
 * @swagger
 * /auth/oauth/google/callback:
 *   get:
 *     summary: Google OAuth callback handler
 *     description: |
 *       The endpoint Google redirects to after successful authentication. 
 *       It exchanges the authorization code for tokens and redirects to the frontend.
 *     tags: [Authentication]
 *     parameters:
 *       - in: query
 *         name: code
 *         required: true
 *         schema: { type: string }
 *         description: The authorization code provided by Google.
 *     responses:
 *       302:
 *         description: Redirect to CLIENT_URL with accessToken in the query string
 */
router.get('/oauth/google/callback', authController.googleCallback);

/**
 * @swagger
 * /auth/refresh-token:
 *   post:
 *     summary: Refresh access token
 *     description: Obtains a new access token using the refreshToken stored in a HttpOnly cookie.
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 accessToken: { type: string }
 *       401:
 *         description: Invalid or expired refresh token
 */
router.post('/refresh-token', authController.refreshToken);

/**
 * @swagger
 * /auth/change-password:
 *   put:
 *     summary: Change password (Authenticated)
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword: { type: string }
 *               newPassword: { type: string }
 *     responses:
 *       200:
 *         description: Password changed
 *       401:
 *         description: Unauthorized or incorrect current password
 */
router.put('/change-password', protect, validate(changePasswordSchema), authController.changePassword);

/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     summary: Initiate password reset
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email: { type: string, format: email }
 *     responses:
 *       200:
*         description: Reset email sent
*       404:
*         description: No account found with this email address
*/
router.post('/forgot-password', validate(forgotPasswordSchema), authController.forgotPassword);

/**
 * @swagger
 * /auth/reset-password:
 *   post:
 *     summary: Reset password
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - newPassword
 *             properties:
 *               token: { type: string }
 *               newPassword: { type: string }
 *     responses:
 *       200:
 *         description: Password reset successful
 *       400:
 *         description: Invalid or expired token
 */
router.post('/reset-password', validate(resetPasswordSchema), authController.resetPassword);

/**
 * @swagger
 * /auth/verify-email:
 *   get:
 *     summary: Verify email
 *     tags: [Authentication]
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Email verified
 *       400:
 *         description: Invalid or expired token
 */
router.get('/verify-email', authController.verifyEmail);

/**
 * @swagger
 * /auth/resend-verification:
 *   post:
 *     summary: Resend verification email
*     tags: [Authentication]
*     requestBody:
*       required: true
*       content:
*         application/json:
*           schema:
*             type: object
*             required: [email]
*             properties:
*               email: { type: string, format: email }
*     responses:
*       200:
*         description: Verification email sent
*/
router.post('/resend-verification', validate(resendVerificationSchema), authController.resendVerification);

/**
 * @swagger
 * /auth/oauth/status:
 *   get:
 *     summary: Get user OAuth linking status
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Returns which providers are linked
 */
router.get('/oauth/status', protect, authController.getOAuthStatus);


module.exports = router;
