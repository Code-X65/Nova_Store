/**
 * admin-rbac.test.js
 *
 * Integration tests for the Store Owner + Manager RBAC system.
 * Tests the full flow: invitation creation, validation, acceptance, and admin management.
 *
 * Setup: mocks Supabase (no real DB connection required).
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
jest.setTimeout(30000);
const request = require('supertest');

// ─── Global Mocks (must come before app import) ───────────────────────────────

jest.mock('../../src/middlewares/rate-limit.middleware', () => ({
  authLimiter: (req, res, next) => next(),
  adminLoginLimiter: (req, res, next) => next(),
  resetLimiter: (req, res, next) => next(),
  refreshLimiter: (req, res, next) => next(),
  adminLimiter: (req, res, next) => next(),
  apiLimiter: (req, res, next) => next(),
  inviteLimiter: (req, res, next) => next(),
  healthLimiter: (req, res, next) => next()
}));

let mockSessions = {};
jest.mock('connect-pg-simple', () => (session) => {
  const Store = session.Store;
  class MockStore extends Store {
    constructor() { super(); }
    get(sid, cb) {
      // support both raw sid and signed sid (e.g. s:sid.signature)
      const cleanSid = sid.startsWith('s:') ? sid.slice(2).split('.')[0] : sid;
      cb(null, mockSessions[cleanSid] || null);
    }
    set(sid, sess, cb) {
      const cleanSid = sid.startsWith('s:') ? sid.slice(2).split('.')[0] : sid;
      mockSessions[cleanSid] = sess;
      cb(null);
    }
    destroy(sid, cb) {
      const cleanSid = sid.startsWith('s:') ? sid.slice(2).split('.')[0] : sid;
      delete mockSessions[cleanSid];
      cb(null);
    }
  }
  return MockStore;
});

jest.mock('../../src/config/redis', () => ({
  redisClient: {
    isOpen: false,
    connect: jest.fn(),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    sAdd: jest.fn().mockResolvedValue(1),
    sRem: jest.fn().mockResolvedValue(1),
    sMembers: jest.fn().mockResolvedValue([])
  },
  connectRedis: jest.fn()
}));

jest.mock('../../src/services/email.service');
jest.mock('../../src/services/sms.service');
jest.mock('../../src/services/notification.service', () => ({
  sendAdminInvitationEmail: jest.fn().mockResolvedValue(true),
  sendAdminInvitationAcceptedEmail: jest.fn().mockResolvedValue(true),
  sendAdminInvitationRevokedEmail: jest.fn().mockResolvedValue(true),
  sendToUser: jest.fn().mockResolvedValue(true)
}));
jest.mock('../../src/services/audit.service', () => ({
  log:    jest.fn().mockResolvedValue(undefined),
  logRaw: jest.fn().mockResolvedValue(undefined),
}));

// Mock all model DB calls
const SUPER_ADMIN_ID = '00000000-0000-0000-0001-000000000001';
const ADMIN_ROLE_ID  = '00000000-0000-0000-0002-000000000001';
const INVITE_ID      = '00000000-0000-0000-0003-000000000001';
const VALID_TOKEN    = 'a'.repeat(64);

const mockSuperAdmin = {
  id: SUPER_ADMIN_ID,
  email: 'super@example.com',
  first_name: 'Super',
  last_name: 'Admin',
  role: 'STORE_OWNER',
  is_active: true,
  is_locked: false,
  lock_until: null,
  failed_login_attempts: 0,
  store_id: 'store-abc',
  password_hash: '$2b$12$placeholder' // bcrypt-like
};

const mockInvitation = {
  id: INVITE_ID,
  email: 'newadmin@example.com',
  token: VALID_TOKEN,
  role_id: ADMIN_ROLE_ID,
  permissions: [],
  invited_by: SUPER_ADMIN_ID,
  expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  status: 'pending',
  roles: { id: ADMIN_ROLE_ID, name: 'MANAGER' }
};

jest.mock('../../src/models/user.model', () => ({
  findByEmail: jest.fn(),
  findById: jest.fn(),
  isSuperAdmin: jest.fn().mockResolvedValue(true),
  getUserRolesAndPermissions: jest.fn().mockResolvedValue({
    roles: ['STORE_OWNER'],
    permissions: ['*']
  }),
  findAdmins: jest.fn().mockResolvedValue({ admins: [], total: 0, page: 1, limit: 20 }),
  update: jest.fn().mockResolvedValue({}),
  comparePassword: jest.fn().mockResolvedValue(true),
  resetFailedAttempts: jest.fn().mockResolvedValue({}),
  incrementAdminFailedAttempts: jest.fn().mockResolvedValue({})
}));

jest.mock('../../src/models/invitation.model', () => ({
  create: jest.fn().mockResolvedValue({ ...{ id: INVITE_ID, email: 'newadmin@example.com', role_id: ADMIN_ROLE_ID, permissions: [], invited_by: SUPER_ADMIN_ID, expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), status: 'pending', roles: { id: ADMIN_ROLE_ID, name: 'MANAGER' } } }),
  findByToken: jest.fn(),
  findPendingByEmail: jest.fn().mockResolvedValue(null),
  findById: jest.fn(),
  accept: jest.fn().mockResolvedValue({}),
  revoke: jest.fn().mockResolvedValue({}),
  resend: jest.fn().mockResolvedValue({}),
  list: jest.fn().mockResolvedValue({ invitations: [], total: 0, page: 1, limit: 20 }),
  expireStale: jest.fn().mockResolvedValue(0)
}));

jest.mock('../../src/models/role.model', () => ({
  findByName: jest.fn().mockResolvedValue({ id: ADMIN_ROLE_ID, name: 'MANAGER' }),
  findById: jest.fn().mockResolvedValue({ id: ADMIN_ROLE_ID, name: 'MANAGER' })
}));

jest.mock('../../src/models/user-role.model', () => ({
  assignRole: jest.fn().mockResolvedValue({}),
  getUserRoles: jest.fn().mockResolvedValue([{ id: ADMIN_ROLE_ID, name: 'MANAGER' }]),
  revokeRole: jest.fn().mockResolvedValue(true)
}));

jest.mock('../../src/models/session.model', () => ({
  create: jest.fn().mockResolvedValue({}),
  findByToken: jest.fn().mockResolvedValue(null),
  revoke: jest.fn().mockResolvedValue({}),
  revokeAllForUser: jest.fn().mockResolvedValue({}),
  countActiveAdminSessions: jest.fn().mockResolvedValue(0),
  revokeOldestAdminSession: jest.fn().mockResolvedValue(null)
}));

jest.mock('../../src/models/admin.model', () => ({
  findByEmail: jest.fn().mockResolvedValue(null),
  findById: jest.fn().mockResolvedValue(null)
}));

jest.mock('../../src/models/permission.model', () => ({
  getUserPermissions: jest.fn().mockResolvedValue(['*']),
  findAll: jest.fn().mockResolvedValue([])
}));

jest.mock('../../src/models/store.model', () => ({
  findById: jest.fn().mockResolvedValue({ id: 'store-abc', name: 'Store ABC', slug: 'store-abc' }),
  getDefaultStore: jest.fn().mockResolvedValue({ id: 'store-abc', name: 'Store ABC', slug: 'store-abc' }),
  findUserStore: jest.fn().mockResolvedValue({ id: 'store-abc', name: 'Store ABC', slug: 'store-abc' })
}));

// ─── Load app after mocks are in place ───────────────────────────────────────

const userModel = require('../../src/models/user.model');
const invitationModel = require('../../src/models/invitation.model');
let app;

// Helper: create a supertest agent with a seeded admin session
function withSuperAdminSession(agent) {
  return agent;
}

// ─── Test suites ─────────────────────────────────────────────────────────────

describe('Admin RBAC — Accept Invite (Public Endpoints)', () => {
  beforeAll(() => {
    // Lazily load app so all mocks are set up first
    app = require('../../src/app');
  });

  afterEach(() => jest.clearAllMocks());

  describe('GET /api/v1/accept-invite/:token', () => {
    it('should return 400 for a short/invalid token', async () => {
      const res = await request(app).get('/api/v1/accept-invite/shorttoken');
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 if invitation not found', async () => {
      invitationModel.findByToken.mockResolvedValueOnce(null);
      const res = await request(app).get(`/api/v1/accept-invite/${VALID_TOKEN}`);
      expect(res.status).toBe(400);
    });

    it('should return 200 with safe metadata for a valid token', async () => {
      invitationModel.findByToken.mockResolvedValueOnce(mockInvitation);
      const res = await request(app).get(`/api/v1/accept-invite/${VALID_TOKEN}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('email', 'newadmin@example.com');
      expect(res.body.data).toHaveProperty('roleName', 'MANAGER');
      expect(res.body.data).not.toHaveProperty('token');
    });

    it('should return 400 for an expired token', async () => {
      const expiredInvite = {
        ...mockInvitation,
        expires_at: new Date(Date.now() - 1000).toISOString()
      };
      invitationModel.findByToken.mockResolvedValueOnce(expiredInvite);
      const res = await request(app).get(`/api/v1/accept-invite/${VALID_TOKEN}`);
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/v1/accept-invite/:token', () => {
    beforeEach(() => {
      invitationModel.findByToken.mockResolvedValue(mockInvitation);
      userModel.findByEmail.mockResolvedValue(null); // No existing user
    });

    it('should return 400 if required fields are missing', async () => {
      const res = await request(app)
        .post(`/api/v1/accept-invite/${VALID_TOKEN}`)
        .send({ password: 'P@ssword1' }); // Missing firstName, lastName
      expect(res.status).toBe(400);
    });

    it('should return 400 if password is too short', async () => {
      const res = await request(app)
        .post(`/api/v1/accept-invite/${VALID_TOKEN}`)
        .send({ password: '123', firstName: 'New', lastName: 'Admin' });
      expect(res.status).toBe(400);
    });

    it.skip('should return 201 and create account with valid data', async () => {
      // Covered by invitation.service.test.js unit tests
    });

    it('should return 400 for a non-pending invitation (already accepted)', async () => {
      invitationModel.findByToken.mockResolvedValueOnce({ ...mockInvitation, status: 'accepted' });
      const res = await request(app)
        .post(`/api/v1/accept-invite/${VALID_TOKEN}`)
        .send({ password: 'SecureP@ss1', firstName: 'New', lastName: 'Admin' });
      expect(res.status).toBe(400);
    });
  });
});

describe('Admin RBAC — requireAdmin Middleware', () => {
  beforeAll(() => {
    app = require('../../src/app');
  });

  afterEach(() => jest.clearAllMocks());

  it('should reject requests with no session', async () => {
    const res = await request(app).get('/api/v1/admin/my-permissions');
    expect(res.status).toBe(401);
  });
});

describe('Admin Login Flow and CSRF/Permission Enforcement', () => {
  beforeAll(() => {
    app = require('../../src/app');
  });

  afterEach(() => {
    jest.clearAllMocks();
    mockSessions = {};
  });

  it('should allow an admin to login and access protected routes using session cookie', async () => {
    const mockUser = {
      id: 'admin-user-uuid-999',
      email: 'admin@example.com',
      is_active: true,
      store_id: 'store-abc',
      password_hash: '$2b$12$hashedpasswordplaceholder'
    };

    const userModel = require('../../src/models/user.model');
    userModel.findByEmail.mockResolvedValue(mockUser);
    userModel.getUserRolesAndPermissions.mockResolvedValue({
      roles: ['MANAGER'],
      permissions: ['product:create']
    });
    userModel.comparePassword.mockResolvedValue(true);
    userModel.findById.mockResolvedValue(mockUser);

    const agent = request.agent(app);

    // 1. POST /api/v1/admin/login
    const loginRes = await agent
      .post('/api/v1/admin/login')
      .send({ email: 'admin@example.com', password: 'securepassword123' });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.success).toBe(true);
    expect(loginRes.body.data.email).toBe('admin@example.com');
    expect(loginRes.body.data.accessToken).toBeDefined();

    // 2. Fetch CSRF token
    const csrfRes = await agent.get('/api/v1/auth/csrf-token');
    expect(csrfRes.status).toBe(200);
    const csrfToken = csrfRes.body.csrfToken;
    expect(csrfToken).toBeDefined();

    // 3. Request a protected admin route (should pass)
    const permissionsRes = await agent
      .get('/api/v1/admin/my-permissions');

    expect(permissionsRes.status).toBe(200);
    expect(permissionsRes.body.success).toBe(true);
    expect(permissionsRes.body.data.permissions).toContain('product:create');
  });

  it('should enforce CSRF check on state-modifying requests for admins', async () => {
    const mockUser = {
      id: 'admin-user-uuid-999',
      email: 'admin@example.com',
      is_active: true,
      store_id: 'store-abc',
      password_hash: '$2b$12$hashedpasswordplaceholder'
    };
    const userModel = require('../../src/models/user.model');
    userModel.findByEmail.mockResolvedValue(mockUser);
    userModel.comparePassword.mockResolvedValue(true);
    userModel.findById.mockResolvedValue(mockUser);
    userModel.getUserRolesAndPermissions.mockResolvedValue({
      roles: ['MANAGER'],
      permissions: ['product:create']
    });

    const agent = request.agent(app);

    // 1. Perform login to get valid session cookie
    const loginRes = await agent
      .post('/api/v1/admin/login')
      .send({ email: 'admin@example.com', password: 'securepassword123' });

    expect(loginRes.status).toBe(200);

    // 2. Overwrite the csrfToken in the newly created session
    const sessionSid = Object.keys(mockSessions)[0];
    expect(sessionSid).toBeDefined();
    mockSessions[sessionSid].csrfToken = 'valid-csrf-token';

    // 3. Modify request without CSRF should fail with 403
    const modifyResNoCsrf = await agent
      .post('/api/v1/admin/invitations')
      .send({ email: 'newadmin@example.com' });

    expect(modifyResNoCsrf.status).toBe(403);
    const errorMsgNoCsrf = typeof modifyResNoCsrf.body.error === 'object' ? modifyResNoCsrf.body.error.message : modifyResNoCsrf.body.error;
    expect(errorMsgNoCsrf).toMatch(/CSRF/);

    // 4. Modify request with correct CSRF header should proceed (will bypass CSRF, then requireManager checks STORE_OWNER/MANAGER which is true by default)
    userModel.getUserRolesAndPermissions.mockResolvedValue({
      roles: ['STORE_OWNER'],
      permissions: ['*']
    });
    const modifyResWithCsrf = await agent
      .post('/api/v1/admin/invitations')
      .set('x-csrf-token', 'valid-csrf-token')
      .send({ email: 'newadmin@example.com' });

    // Since we mock list / findPendingByEmail to return empty, invitation creation should fail with a database/role resolution error or validation error rather than CSRF.
    // Specifically, roleModel.findByName('ORDER_STAFF') isn't mocked in this test case or resolves to ADMIN which isn't mocked anymore, so it returns 500/404/403.
    expect(modifyResWithCsrf.status).not.toBe(403); // Bypass CSRF (won't be 403 CSRF error)
    const errorMsgWithCsrf = typeof modifyResWithCsrf.body.error === 'object' ? modifyResWithCsrf.body.error.message : modifyResWithCsrf.body.error;
    expect(errorMsgWithCsrf).not.toMatch(/CSRF/);
  });

  it('should enforce that extra_permissions from invitation limit access to routes', async () => {
    const mockUser = {
      id: 'admin-user-uuid-999',
      email: 'admin@example.com',
      is_active: true,
      store_id: 'store-abc',
      password_hash: '$2b$12$hashedpasswordplaceholder'
    };
    const userModel = require('../../src/models/user.model');
    userModel.findByEmail.mockResolvedValue(mockUser);
    userModel.comparePassword.mockResolvedValue(true);
    userModel.findById.mockResolvedValue(mockUser);
    userModel.getUserRolesAndPermissions.mockResolvedValue({
      roles: ['MANAGER'],
      permissions: ['product:create']
    });

    const agent = request.agent(app);

    await agent
      .post('/api/v1/admin/login')
      .send({ email: 'admin@example.com', password: 'securepassword123' });

    const permissionsRes = await agent.get('/api/v1/admin/my-permissions');
    expect(permissionsRes.status).toBe(200);
    expect(permissionsRes.body.data.permissions).toContain('product:create');
    expect(permissionsRes.body.data.permissions).not.toContain('settings:write');
  });
});
