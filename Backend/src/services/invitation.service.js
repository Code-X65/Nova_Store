const crypto = require('crypto');
const invitationModel = require('../models/invitation.model');
const userModel = require('../models/user.model');
const roleModel = require('../models/role.model');
const userRoleModel = require('../models/user-role.model');
const notificationService = require('./notification.service');
const AuditService = require('./audit.service');
const eventBus = require('../realtime/event-bus');
const logger = require('../utils/logger');
const bcrypt = require('bcrypt');
const { SINGLE_STORE_ID } = require('../config/store');

const DEFAULT_EXPIRY_DAYS = parseInt(process.env.INVITE_TOKEN_EXPIRY_DAYS || '7', 10);

class InvitationService {
  /**
   * Send an admin invitation email.
   *
   * Validations:
   *   - Inviter must be SUPER_ADMIN
   *   - Email must not already be a registered user
   *   - Email must not already have an active pending invitation
   *
   * @param {object} params
   * @param {string}   params.email          - Recipient email
   * @param {string}   [params.roleId]       - UUID of role (defaults to ADMIN role)
   * @param {string[]} [params.permissions]  - Extra permission slugs
   * @param {string}   params.invitedBy      - UUID of the SuperAdmin user
   * @param {number}   [params.expiryDays]   - Token lifetime in days
   * @param {object}   [params.req]          - Express request (for audit log)
   * @returns {object} Created invitation record (token hidden after creation)
   */
  async createInvitation({ email, roleId, permissions = [], invitedBy, expiryDays, req }) {
    const normalizedEmail = email.toLowerCase().trim();

    // 1. Check inviter is STORE_OWNER or MANAGER
    const inviter = await userModel.findById(invitedBy);
    if (!inviter) {
      const err = new Error('Inviter user not found.');
      err.statusCode = 404;
      throw err;
    }

    const { roles: inviterRoles, permissions: inviterPermissions } = await userModel.getUserRolesAndPermissions(invitedBy);
    const isStoreOwner = inviterRoles.includes('STORE_OWNER');
    const isManager = inviterRoles.includes('MANAGER');

    if (!isStoreOwner && !isManager) {
      const err = new Error('Only Store Owners and Managers can send invitations.');
      err.statusCode = 403;
      throw err;
    }

    // Extra ad-hoc `permissions` attached to the invite must not exceed what the
    // inviter holds themselves — otherwise a MANAGER could hand out permissions
    // (e.g. 'role:manage', 'settings:write') beyond their own ceiling.
    if (!isStoreOwner && permissions && permissions.length > 0) {
      const effectivePermissions = inviterPermissions || [];
      const excess = permissions.filter(p => !effectivePermissions.includes(p));
      if (excess.length > 0) {
        const err = new Error(`Cannot grant permissions you do not hold yourself: ${excess.join(', ')}`);
        err.statusCode = 403;
        throw err;
      }
    }

    // 2. Email must not already be registered
    const existingUser = await userModel.findByEmail(normalizedEmail);
    if (existingUser) {
      const err = new Error('A user account already exists for this email address.');
      err.statusCode = 409;
      throw err;
    }

    // 3. No active pending invitation for this email
    const existingInvite = await invitationModel.findPendingByEmail(normalizedEmail);
    if (existingInvite) {
      const err = new Error('A pending invitation already exists for this email. Revoke or resend it instead.');
      err.statusCode = 409;
      throw err;
    }

    // 4. Resolve role (default to ORDER_STAFF)
    let resolvedRoleId = roleId;
    let resolvedRole = null;
    if (resolvedRoleId) {
      resolvedRole = await roleModel.findById(resolvedRoleId);
      if (!resolvedRole) {
        const err = new Error('Requested role not found.');
        err.statusCode = 404;
        throw err;
      }
    } else {
      const orderStaffRole = await roleModel.findByName('ORDER_STAFF');
      if (!orderStaffRole) {
        const err = new Error('Default ORDER_STAFF role not found.');
        err.statusCode = 500;
        throw err;
      }
      resolvedRoleId = orderStaffRole.id;
      resolvedRole = orderStaffRole;
    }

    // Validate permission scopes for the resolved role:
    // If the inviter is a MANAGER, they can only invite to 'ORDER_STAFF' or 'INVENTORY_STAFF'
    if (isManager && !isStoreOwner) {
      if (resolvedRole.name !== 'ORDER_STAFF' && resolvedRole.name !== 'INVENTORY_STAFF') {
        const err = new Error('Managers can only invite Order Staff or Inventory Staff.');
        err.statusCode = 403;
        throw err;
      }
    }

    // If the inviter is STORE_OWNER, they can invite MANAGER, ORDER_STAFF, or INVENTORY_STAFF.
    if (isStoreOwner) {
      if (resolvedRole.name !== 'MANAGER' && resolvedRole.name !== 'ORDER_STAFF' && resolvedRole.name !== 'INVENTORY_STAFF') {
        const err = new Error('Store Owners can only invite Managers, Order Staff, or Inventory Staff.');
        err.statusCode = 403;
        throw err;
      }
    }

    // 5. Calculate expiry
    const days = expiryDays || DEFAULT_EXPIRY_DAYS;
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    const inviterName = inviter
      ? `${inviter.first_name || ''} ${inviter.last_name || ''}`.trim() || inviter.email
      : 'Nova Store';

    // 6. Create invitation record
    const invitation = await invitationModel.create({
      email: normalizedEmail,
      roleId: resolvedRoleId,
      permissions,
      invitedBy,
      expiresAt,
      store_id: SINGLE_STORE_ID
    });

    // 7. Send email (fire-and-forget — never block the request on SMTP latency)
    const acceptLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/accept-invite/${invitation.token}`;

    notificationService.sendAdminInvitationEmail({
      to: normalizedEmail,
      inviteLink: acceptLink,
      inviterName,
      expiryDate: expiresAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    }).catch((emailErr) => {
      logger.error(`[InvitationService] Failed to send invitation email to ${normalizedEmail}:`, emailErr?.message || emailErr);
    });

    // 8. Audit log
    try {
      await AuditService.log(req, 'admin_invitation_sent', 'invitation', invitation.id, null, { email: normalizedEmail, roleId: resolvedRoleId });
    } catch (_) { /* non-critical */ }

    logger.info(`[InvitationService] Invitation sent to ${normalizedEmail} by user ${invitedBy}`);

    // Return without exposing the raw token
    const { token: _token, ...safeInvitation } = invitation;
    return safeInvitation;
  }

  /**
   * Validate an invitation token (public endpoint — GET accept-invite).
   * Returns safe metadata (email, role name, expires_at) — never the raw token.
   *
   * @param {string} token
   * @returns {object} { email, roleName, expiresAt }
   */
  async validateInvitationToken(token) {
    const invitation = await this._getValidInvitation(token);
    return {
      email: invitation.email,
      roleName: invitation.roles?.name || null,
      expiresAt: invitation.expires_at
    };
  }

  /**
   * Accept an invitation: create the user account, assign role, mark invitation accepted.
   *
   * @param {string} token
   * @param {object} userData
   * @param {string} userData.password
   * @param {string} userData.firstName
   * @param {string} userData.lastName
   * @returns {object} Newly created user (password_hash stripped)
   */
  async acceptInvitation(token, { password, firstName, lastName }) {
    const invitation = await this._getValidInvitation(token);

    // Double-check email isn't already taken (race condition guard)
    const existing = await userModel.findByEmail(invitation.email);
    if (existing) {
      const err = new Error('An account with this email already exists.');
      err.statusCode = 409;
      throw err;
    }

    // Hash password
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    // Determine role name for users.role column
    const roleName = invitation.roles?.name || 'ADMIN';

    // Generate unique referral code (same logic as userModel.create)
    let referralCode;
    let isUnique = false;
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    while (!isUnique) {
      referralCode = '';
      for (let i = 0; i < 12; i++) {
        referralCode += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      const existingUserCode = await userModel.findByReferralCode(referralCode);
      if (!existingUserCode) {
        isUnique = true;
      }
    }

    // Create user
    const { supabaseAdmin } = require('../config/supabase');
    const { data: newUser, error: userError } = await supabaseAdmin
      .from('users')
      .insert([{
        email: invitation.email,
        password_hash: passwordHash,
        first_name: firstName,
        last_name: lastName,
        role: roleName,
        is_email_verified: true, // Invitation link serves as email verification
        is_active: true,
        failed_login_attempts: 0,
        extra_permissions: invitation.permissions || [],
        referral_code: referralCode,
        store_id: SINGLE_STORE_ID
      }])
      .select()
      .single();

    if (userError) throw userError;

    // Assign role via user_roles
    await userRoleModel.assignRole(newUser.id, invitation.role_id, invitation.invited_by);

    // Assign any extra granular permissions directly (stored in user_roles or a separate table)
    // For now we store them as additional role_permissions override via the invitation.permissions JSONB
    // The middleware reads these when building req.admin.permissions

    // Mark invitation accepted
    await invitationModel.accept(token, newUser.id);

    // Security-critical: new staff user created → Owners alert.
    const inviter = await userModel.findById(invitation.invited_by);
    const inviterName = inviter ? `${inviter.first_name || ''} ${inviter.last_name || ''}`.trim() : null;
    eventBus.emit('staff.user_created', {
      actor: { id: invitation.invited_by, fullName: inviterName, role: 'STORE_OWNER' },
      resourceType: 'user',
      resourceId: newUser.id,
      actionType: 'CREATE',
      severity: 'critical',
      title: 'New staff user created',
      message: `${firstName} ${lastName} (${invitation.email}) was granted the ${roleName} role via invitation.`,
      newValues: { email: invitation.email, role: roleName },
      data: { userId: newUser.id, email: invitation.email, role: roleName, invitedBy: invitation.invited_by },
      deepLink: `/staff/${newUser.id}`,
    });

    // Send acceptance notification to inviter (fire-and-forget)
    if (inviter) {
      notificationService.sendAdminInvitationAcceptedEmail({
        to: inviter.email,
        newAdminName: `${firstName} ${lastName}`.trim(),
        newAdminEmail: invitation.email
      }).catch((emailErr) => {
        logger.error(`[InvitationService] Failed to send acceptance email to ${inviter.email}:`, emailErr?.message || emailErr);
      });
    }

    logger.info(`[InvitationService] Invitation accepted by ${invitation.email} — user ${newUser.id} created`);

    // Strip password_hash from response
    const { password_hash: _ph, ...safeUser } = newUser;
    return safeUser;
  }

  /**
   * List invitations. SUPER_ADMIN sees all; ADMIN sees only theirs.
   *
   * @param {object} filters
   * @param {string} requesterId
   * @param {boolean} isSuperAdmin
   */
  async listInvitations(filters, requesterId, isSuperAdmin) {
    const effectiveFilters = { ...filters };
    effectiveFilters.store_id = SINGLE_STORE_ID;
    if (!isSuperAdmin) {
      effectiveFilters.invitedBy = requesterId;
    }
    return await invitationModel.list(effectiveFilters);
  }

  /**
   * Get a single invitation by ID.
   *
   * @param {string} id          - Invitation UUID
   * @param {string} requesterId - Requester's user_id
   * @param {boolean} isSuperAdmin
   * @param {string} [storeId]   - Requester's store_id
   */
  async getInvitation(id, requesterId, isSuperAdmin) {
    const invitation = await invitationModel.findById(id);
    if (!invitation) {
      const err = new Error('Invitation not found.');
      err.statusCode = 404;
      throw err;
    }

    if (invitation.store_id !== SINGLE_STORE_ID) {
      const err = new Error('Access denied: store mismatch.');
      err.statusCode = 403;
      throw err;
    }

    if (!isSuperAdmin && invitation.invited_by !== requesterId) {
      const err = new Error('Access denied.');
      err.statusCode = 403;
      throw err;
    }

    return invitation;
  }

  /**
   * Revoke a pending invitation.
   *
   * @param {string} id
   * @param {string} requesterId
   * @param {boolean} isSuperAdmin
   * @param {string} [storeId]   - Requester's store_id
   */
  async revokeInvitation(id, requesterId, isSuperAdmin, req) {
    const invitation = await invitationModel.findById(id);
    if (!invitation) {
      const err = new Error('Invitation not found.');
      err.statusCode = 404;
      throw err;
    }

    if (invitation.store_id !== SINGLE_STORE_ID) {
      const err = new Error('Access denied: store mismatch.');
      err.statusCode = 403;
      throw err;
    }

    if (!isSuperAdmin && invitation.invited_by !== requesterId) {
      const err = new Error('Access denied.');
      err.statusCode = 403;
      throw err;
    }

    if (invitation.status !== 'pending') {
      const err = new Error(`Cannot revoke invitation with status '${invitation.status}'.`);
      err.statusCode = 400;
      throw err;
    }

    const revoked = await invitationModel.revoke(id);

    // Send revocation email (fire-and-forget)
    notificationService.sendAdminInvitationRevokedEmail({ to: invitation.email })
      .catch((emailErr) => {
        logger.error(`[InvitationService] Failed to send revocation email to ${invitation.email}:`, emailErr?.message || emailErr);
      });

    await AuditService.log(req, 'admin_invitation_revoked', 'invitation', id).catch(() => {});

    return revoked;
  }

  /**
   * Resend (and extend) an invitation.
   *
   * @param {string} id
   * @param {string} requesterId
   * @param {boolean} isSuperAdmin
   */
  async resendInvitation(id, requesterId, isSuperAdmin, req) {
    const invitation = await invitationModel.findById(id);
    if (!invitation) {
      const err = new Error('Invitation not found.');
      err.statusCode = 404;
      throw err;
    }

    if (invitation.store_id !== SINGLE_STORE_ID) {
      const err = new Error('Access denied: store mismatch.');
      err.statusCode = 403;
      throw err;
    }

    if (!isSuperAdmin && invitation.invited_by !== requesterId) {
      const err = new Error('Access denied.');
      err.statusCode = 403;
      throw err;
    }

    if (invitation.status === 'accepted') {
      const err = new Error('Cannot resend an already accepted invitation.');
      err.statusCode = 400;
      throw err;
    }

    const days = DEFAULT_EXPIRY_DAYS;
    const newExpiry = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    const updated = await invitationModel.resend(id, newExpiry);

    // Resend the email (fire-and-forget)
    const inviter = await userModel.findById(requesterId);
    const inviterName = inviter
      ? `${inviter.first_name || ''} ${inviter.last_name || ''}`.trim() || inviter.email
      : 'Nova Store';
    const acceptLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/accept-invite/${invitation.token}`;

    notificationService.sendAdminInvitationEmail({
      to: invitation.email,
      inviteLink: acceptLink,
      inviterName,
      expiryDate: newExpiry.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    }).catch((emailErr) => {
      logger.error(`[InvitationService] Failed to resend invitation email to ${invitation.email}:`, emailErr?.message || emailErr);
    });

    await AuditService.log(req, 'admin_invitation_resent', 'invitation', id).catch(() => {});

    return updated;
  }

  /**
   * Expire stale invitations (called by cleanup cron job).
   */
  async cleanupExpired() {
    const count = await invitationModel.expireStale();
    if (count > 0) {
      logger.info(`[InvitationService] Expired ${count} stale invitation(s).`);
    }
    return count;
  }

  // ─── Private helpers ──────────────────────────────────────

  /**
   * Internal: load and validate a token. Returns the invitation or throws.
   * Uses generic error messages to prevent email enumeration.
   */
  async _getValidInvitation(token) {
    if (!token || token.length !== 64) {
      const err = new Error('Invalid or expired invitation token.');
      err.statusCode = 400;
      throw err;
    }

    const invitation = await invitationModel.findByToken(token);

    if (!invitation || invitation.status !== 'pending') {
      const err = new Error('Invalid or expired invitation token.');
      err.statusCode = 400;
      throw err;
    }

    if (new Date(invitation.expires_at) < new Date()) {
      // Expire it
      await invitationModel.revoke(invitation.id).catch(() => {});
      const err = new Error('Invalid or expired invitation token.');
      err.statusCode = 400;
      throw err;
    }

    return invitation;
  }
}

module.exports = new InvitationService();
