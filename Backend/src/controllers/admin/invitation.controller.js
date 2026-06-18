const invitationService = require('../../services/invitation.service');
const logger = require('../../utils/logger');

/**
 * Invitation Controller — SUPER_ADMIN only
 *
 * All routes require requireSuperAdmin middleware (mounted in invitation.routes.js).
 */
class InvitationController {
  /**
   * POST /api/v1/admin/invitations
   * Send a new admin invitation.
   */
  async createInvitation(req, res, next) {
    try {
      const { email, roleId, permissions, expiryDays } = req.body;
      const invitedBy = req.admin.id;

      if (!email) {
        return res.status(400).json({ success: false, error: 'Email is required.' });
      }

      const invitation = await invitationService.createInvitation({
        email,
        roleId,
        permissions: permissions || [],
        invitedBy,
        expiryDays,
        req
      });

      return res.status(201).json({
        success: true,
        message: `Invitation sent to ${email}.`,
        data: invitation
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/admin/invitations
   * List invitations (paginated, filterable).
   */
  async listInvitations(req, res, next) {
    try {
      const { status, search, page = 1, limit = 20 } = req.query;
      const requesterId = req.admin.id;
      const isSuperAdmin = req.admin.role === 'SUPER_ADMIN';

      const result = await invitationService.listInvitations(
        { status, search, page: parseInt(page), limit: parseInt(limit) },
        requesterId,
        isSuperAdmin
      );

      return res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/admin/invitations/:id
   * Get a single invitation by UUID.
   */
  async getInvitation(req, res, next) {
    try {
      const { id } = req.params;
      const requesterId = req.admin.id;
      const isSuperAdmin = req.admin.role === 'SUPER_ADMIN';

      const invitation = await invitationService.getInvitation(id, requesterId, isSuperAdmin);
      return res.json({ success: true, data: invitation });
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/v1/admin/invitations/:id
   * Revoke a pending invitation.
   */
  async revokeInvitation(req, res, next) {
    try {
      const { id } = req.params;
      const requesterId = req.admin.id;
      const isSuperAdmin = req.admin.role === 'SUPER_ADMIN';

      await invitationService.revokeInvitation(id, requesterId, isSuperAdmin, req);
      return res.json({ success: true, message: 'Invitation revoked.' });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/admin/invitations/:id/resend
   * Resend and extend an invitation.
   */
  async resendInvitation(req, res, next) {
    try {
      const { id } = req.params;
      const requesterId = req.admin.id;
      const isSuperAdmin = req.admin.role === 'SUPER_ADMIN';

      await invitationService.resendInvitation(id, requesterId, isSuperAdmin, req);
      return res.json({ success: true, message: 'Invitation resent.' });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new InvitationController();
