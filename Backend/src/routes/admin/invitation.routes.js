const express = require('express');
const router = express.Router();
const requireSuperAdmin = require('../../middlewares/require-super-admin.middleware');
const invitationController = require('../../controllers/admin/invitation.controller');
const { inviteLimiter } = require('../../middlewares/rate-limit.middleware');

/**
 * @swagger
 * tags:
 *   name: Admin Invitations
 *   description: SuperAdmin-only administrative invitations
 */

/**
 * @swagger
 * /admin/invitations:
 *   post:
 *     summary: Create and send a new admin invitation (SuperAdmin only)
 *     tags: [Admin Invitations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: admin@novastore.com
 *               roleId:
 *                 type: string
 *                 format: uuid
 *                 description: Optional. Role UUID to assign. Defaults to ADMIN role.
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Optional. Array of granular permission slugs.
 *     responses:
 *       201:
 *         description: Invitation created and email sent successfully
 *       400:
 *         description: Validation error
 *       403:
 *         description: Forbidden (Only SUPER_ADMIN)
 *       409:
 *         description: Conflict (User or pending invite already exists)
 */
router.post('/', requireSuperAdmin, inviteLimiter, invitationController.createInvitation.bind(invitationController));

/**
 * @swagger
 * /admin/invitations:
 *   get:
 *     summary: List all admin invitations (SuperAdmin only)
 *     tags: [Admin Invitations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, accepted, expired, revoked]
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Partial email search
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Paginated list of invitations
 *       403:
 *         description: Forbidden
 */
router.get('/', requireSuperAdmin, invitationController.listInvitations.bind(invitationController));

/**
 * @swagger
 * /admin/invitations/{id}:
 *   get:
 *     summary: Get a single invitation by ID (SuperAdmin only)
 *     tags: [Admin Invitations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Invitation details
 *       404:
 *         description: Invitation not found
 */
router.get('/:id', requireSuperAdmin, invitationController.getInvitation.bind(invitationController));

/**
 * @swagger
 * /admin/invitations/{id}:
 *   delete:
 *     summary: Revoke a pending invitation (SuperAdmin only)
 *     tags: [Admin Invitations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Invitation successfully revoked
 *       400:
 *         description: Cannot revoke non-pending invitation
 *       404:
 *         description: Invitation not found
 */
router.delete('/:id', requireSuperAdmin, invitationController.revokeInvitation.bind(invitationController));

/**
 * @swagger
 * /admin/invitations/{id}/resend:
 *   post:
 *     summary: Resend and extend a pending invitation (SuperAdmin only)
 *     tags: [Admin Invitations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Invitation successfully resent and extended
 *       400:
 *         description: Cannot resend accepted invitation
 *       404:
 *         description: Invitation not found
 */
router.post('/:id/resend', requireSuperAdmin, invitationController.resendInvitation.bind(invitationController));

module.exports = router;
