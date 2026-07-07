const invitationService = require('../../../src/services/invitation.service');
const invitationModel = require('../../../src/models/invitation.model');
const userModel = require('../../../src/models/user.model');
const roleModel = require('../../../src/models/role.model');
const userRoleModel = require('../../../src/models/user-role.model');
const notificationService = require('../../../src/services/notification.service');
const AuditService = require('../../../src/services/audit.service');
const logger = require('../../../src/utils/logger');

jest.mock('../../../src/models/invitation.model');
jest.mock('../../../src/models/user.model');
jest.mock('../../../src/models/role.model');
jest.mock('../../../src/models/user-role.model');
jest.mock('../../../src/services/notification.service');
jest.mock('../../../src/services/audit.service');
jest.mock('../../../src/utils/logger');
jest.mock('../../../src/config/supabase', () => ({
  supabaseAdmin: {
    from: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: { id: 'new-user-id', email: 'new@admin.com', first_name: 'New', last_name: 'Admin', role: 'ORDER_STAFF', password_hash: 'hashed' }, error: null })
  }
}));

describe('InvitationService', () => {
  const superAdminId = 'super-admin-uuid';
  const adminRoleId = 'admin-role-uuid';
  const mockInvitation = {
    id: 'invite-uuid-1',
    email: 'invited@example.com',
    token: 'a'.repeat(64),
    role_id: adminRoleId,
    permissions: [],
    invited_by: superAdminId,
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'pending',
    store_id: 'store-abc',
    roles: { id: adminRoleId, name: 'ORDER_STAFF' }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Default: caller is STORE_OWNER
    userModel.getUserRolesAndPermissions.mockResolvedValue({
      roles: ['STORE_OWNER'],
      permissions: ['*']
    });
    userModel.findByEmail.mockResolvedValue(null); // No existing user
    invitationModel.findPendingByEmail.mockResolvedValue(null); // No pending invite
    roleModel.findByName.mockResolvedValue({ id: adminRoleId, name: 'ORDER_STAFF' });
    roleModel.findById.mockResolvedValue({ id: adminRoleId, name: 'ORDER_STAFF' });
    invitationModel.create.mockResolvedValue(mockInvitation);
    userModel.findById.mockResolvedValue({
      id: superAdminId,
      email: 'super@example.com',
      first_name: 'Super',
      last_name: 'Admin',
      store_id: 'store-abc'
    });
    notificationService.sendAdminInvitationEmail.mockResolvedValue(true);
    AuditService.log.mockResolvedValue(undefined);
  });

  // ─── createInvitation ────────────────────────────────────────────────────────

  describe('createInvitation', () => {
    it('should create an invitation and return safe data (no raw token)', async () => {
      const result = await invitationService.createInvitation({
        email: 'invited@example.com',
        invitedBy: superAdminId
      });

      expect(invitationModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'invited@example.com',
          roleId: adminRoleId,
          invitedBy: superAdminId
        })
      );
      expect(result).not.toHaveProperty('token');
    });

    it('should throw 403 if inviter is not STORE_OWNER or MANAGER', async () => {
      userModel.getUserRolesAndPermissions.mockResolvedValue({
        roles: ['CUSTOMER'],
        permissions: []
      });

      await expect(
        invitationService.createInvitation({ email: 'invited@example.com', invitedBy: 'regular-admin-id' })
      ).rejects.toMatchObject({ statusCode: 403 });

      expect(invitationModel.create).not.toHaveBeenCalled();
    });

    it('should throw 409 if email is already registered', async () => {
      userModel.findByEmail.mockResolvedValue({ id: 'existing-user-id', email: 'invited@example.com' });

      await expect(
        invitationService.createInvitation({ email: 'invited@example.com', invitedBy: superAdminId })
      ).rejects.toMatchObject({ statusCode: 409 });
    });

    it('should throw 409 if a pending invitation already exists for this email', async () => {
      invitationModel.findPendingByEmail.mockResolvedValue(mockInvitation);

      await expect(
        invitationService.createInvitation({ email: 'invited@example.com', invitedBy: superAdminId })
      ).rejects.toMatchObject({ statusCode: 409 });
    });

    it('should use the provided roleId instead of defaulting to ORDER_STAFF', async () => {
      const customRoleId = 'moderator-role-uuid';
      roleModel.findById.mockResolvedValue({ id: customRoleId, name: 'INVENTORY_STAFF' });

      await invitationService.createInvitation({
        email: 'new@example.com',
        roleId: customRoleId,
        invitedBy: superAdminId
      });

      expect(roleModel.findByName).not.toHaveBeenCalled();
      expect(invitationModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ roleId: customRoleId })
      );
    });

    it('should still create the invitation even if email sending fails', async () => {
      notificationService.sendAdminInvitationEmail.mockRejectedValue(new Error('SMTP error'));

      const result = await invitationService.createInvitation({
        email: 'invited@example.com',
        invitedBy: superAdminId
      });

      expect(result).toBeDefined();
      expect(invitationModel.create).toHaveBeenCalled();
    });
  });

  // ─── validateInvitationToken ─────────────────────────────────────────────────

  describe('validateInvitationToken', () => {
    it('should return safe metadata for a valid token', async () => {
      invitationModel.findByToken.mockResolvedValue(mockInvitation);

      const result = await invitationService.validateInvitationToken('a'.repeat(64));

      expect(result).toEqual({
        email: mockInvitation.email,
        roleName: 'ORDER_STAFF',
        expiresAt: mockInvitation.expires_at
      });
      expect(result).not.toHaveProperty('token');
    });

    it('should throw 400 for a token of wrong length', async () => {
      await expect(
        invitationService.validateInvitationToken('short')
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('should throw 400 if invitation is not found', async () => {
      invitationModel.findByToken.mockResolvedValue(null);

      await expect(
        invitationService.validateInvitationToken('b'.repeat(64))
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('should throw 400 if invitation status is not pending', async () => {
      invitationModel.findByToken.mockResolvedValue({ ...mockInvitation, status: 'accepted' });

      await expect(
        invitationService.validateInvitationToken('a'.repeat(64))
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('should throw 400 if invitation has expired', async () => {
      const expired = {
        ...mockInvitation,
        expires_at: new Date(Date.now() - 1000).toISOString()
      };
      invitationModel.findByToken.mockResolvedValue(expired);
      invitationModel.revoke.mockResolvedValue(null);

      await expect(
        invitationService.validateInvitationToken('a'.repeat(64))
      ).rejects.toMatchObject({ statusCode: 400 });
    });
  });

  // ─── listInvitations ─────────────────────────────────────────────────────────

  describe('listInvitations', () => {
    it('should list all invitations when caller is STORE_OWNER', async () => {
      const mockList = { invitations: [mockInvitation], total: 1, page: 1, limit: 20 };
      invitationModel.list.mockResolvedValue(mockList);

      const result = await invitationService.listInvitations({}, superAdminId, true, 'store-abc');

      expect(result).toEqual(mockList);
    });

    it('should restrict to own invitations when caller is a regular MANAGER', async () => {
      const regularAdminId = 'regular-admin-uuid';
      invitationModel.list.mockResolvedValue({ invitations: [], total: 0, page: 1, limit: 20 });

      await invitationService.listInvitations({}, regularAdminId, false, 'store-abc');

      expect(invitationModel.list).toHaveBeenCalledWith(
        expect.objectContaining({ invitedBy: regularAdminId })
      );
    });
  });

  // ─── revokeInvitation ────────────────────────────────────────────────────────

  describe('revokeInvitation', () => {
    it('should revoke a pending invitation', async () => {
      invitationModel.findById.mockResolvedValue(mockInvitation);
      invitationModel.revoke.mockResolvedValue({ ...mockInvitation, status: 'revoked' });
      notificationService.sendAdminInvitationRevokedEmail.mockResolvedValue(true);

      await invitationService.revokeInvitation(mockInvitation.id, superAdminId, true, 'store-abc', {});

      expect(invitationModel.revoke).toHaveBeenCalledWith(mockInvitation.id);
    });

    it('should throw 404 if invitation does not exist', async () => {
      invitationModel.findById.mockResolvedValue(null);

      await expect(
        invitationService.revokeInvitation('nonexistent-id', superAdminId, true, 'store-abc', {})
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('should throw 400 if invitation is already accepted', async () => {
      invitationModel.findById.mockResolvedValue({ ...mockInvitation, status: 'accepted' });

      await expect(
        invitationService.revokeInvitation(mockInvitation.id, superAdminId, true, 'store-abc', {})
      ).rejects.toMatchObject({ statusCode: 400 });
    });
  });

  // ─── acceptInvitation ────────────────────────────────────────────────────────

  describe('acceptInvitation', () => {
    const mockSupabase = require('../../../src/config/supabase').supabaseAdmin;

    beforeEach(() => {
      invitationModel.findByToken.mockResolvedValue({
        ...mockInvitation,
        permissions: ['product:create', 'product:delete']
      });
      userModel.findByEmail.mockResolvedValue(null);
    });

    it('should successfully accept an invitation, create the user with extra_permissions, and assign roles', async () => {
      const result = await invitationService.acceptInvitation('a'.repeat(64), {
        password: 'Password123!',
        firstName: 'New',
        lastName: 'Admin'
      });

      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            email: 'invited@example.com',
            extra_permissions: ['product:create', 'product:delete'],
            role: 'ORDER_STAFF'
          })
        ])
      );
      expect(userRoleModel.assignRole).toHaveBeenCalledWith('new-user-id', adminRoleId, superAdminId);
      expect(invitationModel.accept).toHaveBeenCalledWith('a'.repeat(64), 'new-user-id');
      expect(notificationService.sendAdminInvitationAcceptedEmail).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should throw 409 if user with email already exists', async () => {
      userModel.findByEmail.mockResolvedValue({ id: 'existing-id' });

      await expect(
        invitationService.acceptInvitation('a'.repeat(64), {
          password: 'Password123!',
          firstName: 'New',
          lastName: 'Admin'
        })
      ).rejects.toMatchObject({ statusCode: 409 });
    });
  });

  // ─── cleanupExpired ───────────────────────────────────────────────────────────

  describe('cleanupExpired', () => {
    it('should call expireStale and log the count', async () => {
      invitationModel.expireStale.mockResolvedValue(3);
      logger.info.mockImplementation(() => {});

      const count = await invitationService.cleanupExpired();

      expect(count).toBe(3);
      expect(invitationModel.expireStale).toHaveBeenCalled();
    });
  });
});
