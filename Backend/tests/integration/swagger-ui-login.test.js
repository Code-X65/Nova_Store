const request = require('supertest');
const app = require('../../src/app');

// Mock models and config
jest.mock('../../src/models/user.model');
jest.mock('../../src/models/user-role.model');
jest.mock('../../src/models/permission.model');

let mockSessions = {};
jest.mock('connect-pg-simple', () => (session) => {
  const Store = session.Store;
  class MockStore extends Store {
    constructor() { super(); }
    get(sid, cb) {
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

const userModel = require('../../src/models/user.model');
const userRoleModel = require('../../src/models/user-role.model');
const permissionModel = require('../../src/models/permission.model');

describe('Swagger UI Sign-In Integration Tests', () => {
  beforeEach(() => {
    mockSessions = {};
    jest.clearAllMocks();
    
    // Default mocks
    userModel.findByEmail.mockResolvedValue(null);
    userRoleModel.getUserRoles.mockResolvedValue([]);
    permissionModel.getUserPermissions.mockResolvedValue([]);
    
    process.env.NODE_ENV = 'development';
    process.env.SWAGGER_USER = 'admin';
    process.env.SWAGGER_PASSWORD = 'password';
  });

  afterEach(() => {
    delete process.env.SWAGGER_USER;
    delete process.env.SWAGGER_PASSWORD;
  });

  describe('Unauthenticated Access Redirects', () => {
    it('should redirect GET /api-docs to /api-docs/login', async () => {
      const res = await request(app)
        .get('/api-docs')
        .expect(302);
        
      expect(res.headers.location).toBe('/api-docs/login');
    });

    it('should redirect GET /api-docs/index.html to /api-docs/login', async () => {
      const res = await request(app)
        .get('/api-docs/index.html')
        .expect(302);
        
      expect(res.headers.location).toBe('/api-docs/login');
    });
  });

  describe('GET /api-docs/login UI Page', () => {
    it('should serve the HTML sign-in form successfully', async () => {
      const res = await request(app)
        .get('/api-docs/login')
        .expect(200);

      expect(res.text).toContain('Nova Store');
      expect(res.text).toContain('SYSTEM ACCESS TERMINAL');
      expect(res.text).toContain('name="_csrf"');
    });

    it('should display timeout warning when reason query parameter is active', async () => {
      const res = await request(app)
        .get('/api-docs/login?reason=inactive')
        .expect(200);

      expect(res.text).toContain('Session expired due to inactivity');
    });
  });

  describe('POST /api-docs/login Credentials Validation', () => {
    it('should fail with 403 on missing CSRF token', async () => {
      const res = await request(app)
        .post('/api-docs/login')
        .send({ username: 'admin', password: 'password' }) // no _csrf
        .expect(403);

      expect(res.text).toContain('Invalid CSRF token');
    });

    it('should fail with 403 on invalid CSRF token', async () => {
      const agent = request.agent(app);
      
      // Get the page first to initialize a session and obtain the CSRF token
      await agent.get('/api-docs/login');
      
      const res = await agent
        .post('/api-docs/login')
        .send({ username: 'admin', password: 'password', _csrf: 'wrong-csrf' })
        .expect(403);

      expect(res.text).toContain('Invalid CSRF token');
    });

    it('should authenticate successfully with correct env credentials and redirect to /api-docs/', async () => {
      const agent = request.agent(app);
      
      // Get CSRF token
      const getRes = await agent.get('/api-docs/login');
      const csrfMatch = getRes.text.match(/name="_csrf" value="([^"]+)"/);
      const csrfToken = csrfMatch ? csrfMatch[1] : '';

      const res = await agent
        .post('/api-docs/login')
        .send({ username: 'admin', password: 'password', _csrf: csrfToken })
        .expect(302);

      expect(res.headers.location).toBe('/api-docs/');

      // Subsequent access to /api-docs/ should succeed and load the swagger UI
      await agent
        .get('/api-docs/')
        .expect(200);
    });

    it('should authenticate successfully with database admin credentials', async () => {
      const mockDBUser = {
        id: 'db-admin-uuid',
        email: 'CODEX',
        password_hash: 'hashed_pass',
        role: 'ADMIN',
        is_active: true,
        failed_login_attempts: 0,
        is_locked: false,
        lock_until: null
      };
      
      userModel.findByEmail.mockResolvedValue(mockDBUser);
      userModel.comparePassword.mockResolvedValue(true);
      userModel.findById.mockResolvedValue(mockDBUser);

      const agent = request.agent(app);
      
      const getRes = await agent.get('/api-docs/login');
      const csrfMatch = getRes.text.match(/name="_csrf" value="([^"]+)"/);
      const csrfToken = csrfMatch ? csrfMatch[1] : '';

      await agent
        .post('/api-docs/login')
        .send({ username: 'CODEX', password: 'MySuperSecretPassword123!', _csrf: csrfToken })
        .expect(302);

      expect(userModel.findByEmail).toHaveBeenCalledWith('CODEX');
      expect(userModel.comparePassword).toHaveBeenCalledWith('MySuperSecretPassword123!', 'hashed_pass');
    });
  });
});
