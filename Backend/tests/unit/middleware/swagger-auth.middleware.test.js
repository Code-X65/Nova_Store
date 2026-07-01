const swaggerAuth = require('../../../src/middlewares/swagger-auth.middleware');
const logger = require('../../../src/utils/logger');
const userModel = require('../../../src/models/user.model');

jest.mock('../../../src/utils/logger', () => ({
  warn: jest.fn(),
  error: jest.fn()
}));
jest.mock('../../../src/models/user.model');

describe('Swagger Auth Middleware (Session/UI Upgrade)', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    swaggerAuth._resetCache();

    req = {
      path: '/',
      method: 'GET',
      session: {
        csrfToken: 'mock-csrf-token'
      },
      body: {},
      query: {},
      ip: '127.0.0.1'
    };

    res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      redirect: jest.fn().mockReturnThis()
    };

    next = jest.fn();

    // Default mock: user not found in DB
    userModel.findByEmail.mockResolvedValue(null);

    // Default env setup
    process.env.NODE_ENV = 'development';
    process.env.SWAGGER_USER = 'admin';
    process.env.SWAGGER_PASSWORD = 'password';
  });

  afterEach(() => {
    // Restore env changes
    delete process.env.SWAGGER_USER;
    delete process.env.SWAGGER_PASSWORD;
  });

  describe('GET /api-docs/login', () => {
    it('should serve the HTML sign-in form', async () => {
      req.path = '/login';
      req.method = 'GET';

      await swaggerAuth(req, res, next);

      expect(res.send).toHaveBeenCalledWith(expect.stringContaining('Nova Store'));
      expect(res.send).toHaveBeenCalledWith(expect.stringContaining('SYSTEM ACCESS TERMINAL'));
      expect(res.send).toHaveBeenCalledWith(expect.stringContaining('mock-csrf-token'));
      expect(next).not.toHaveBeenCalled();
    });

    it('should show inactive warning if reason=inactive', async () => {
      req.path = '/login';
      req.method = 'GET';
      req.query.reason = 'inactive';

      await swaggerAuth(req, res, next);

      expect(res.send).toHaveBeenCalledWith(expect.stringContaining('Session expired due to inactivity'));
    });

    it('should show expired warning if reason=expired', async () => {
      req.path = '/login';
      req.method = 'GET';
      req.query.reason = 'expired';

      await swaggerAuth(req, res, next);

      expect(res.send).toHaveBeenCalledWith(expect.stringContaining('Maximum session duration reached'));
    });
  });

  describe('POST /api-docs/login - CSRF checks', () => {
    it('should return 403 on missing CSRF token', async () => {
      req.path = '/login';
      req.method = 'POST';
      req.body = { username: 'admin', password: 'password' }; // no _csrf

      await swaggerAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.send).toHaveBeenCalledWith(expect.stringContaining('Invalid CSRF token'));
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 403 on invalid CSRF token', async () => {
      req.path = '/login';
      req.method = 'POST';
      req.body = { username: 'admin', password: 'password', _csrf: 'wrong-token' };

      await swaggerAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.send).toHaveBeenCalledWith(expect.stringContaining('Invalid CSRF token'));
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('POST /api-docs/login - Credentials & Fallbacks', () => {
    it('should authenticate successfully with Env variables and redirect to /api-docs/', async () => {
      req.path = '/login';
      req.method = 'POST';
      req.body = { username: 'admin', password: 'password', _csrf: 'mock-csrf-token' };

      await swaggerAuth(req, res, next);

      expect(req.session.swaggerAuth).toBe(true);
      expect(req.session.swaggerAuthLoginTime).toBeDefined();
      expect(req.session.swaggerAuthLastActivity).toBeDefined();
      expect(res.redirect).toHaveBeenCalledWith('/api-docs/');
      expect(next).not.toHaveBeenCalled();
    });

    it('should fail with wrong credentials and return 401 with error message', async () => {
      req.path = '/login';
      req.method = 'POST';
      req.body = { username: 'admin', password: 'wrongpassword', _csrf: 'mock-csrf-token' };

      await swaggerAuth(req, res, next);

      expect(req.session.swaggerAuth).toBeUndefined();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.send).toHaveBeenCalledWith(expect.stringContaining('Invalid username or password'));
      expect(next).not.toHaveBeenCalled();
    });

    it('should generate a random password in production if SWAGGER_PASSWORD is not set and mock login succeeds with it', async () => {
      delete process.env.SWAGGER_PASSWORD;
      process.env.NODE_ENV = 'production';

      req.path = '/login';
      req.method = 'POST';
      req.body = { username: 'admin', password: 'wrongpassword', _csrf: 'mock-csrf-token' };

      // Call once to trigger random password generation
      await swaggerAuth(req, res, next);
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('SWAGGER_PASSWORD is not set in production'));

      // Extract password
      const warningMessage = logger.warn.mock.calls[0][0];
      const match = warningMessage.match(/Generated a random password: ([a-f0-9]+)/);
      expect(match).not.toBeNull();
      const generatedPassword = match[1];

      // Now login with correct generated password
      req.body.password = generatedPassword;
      await swaggerAuth(req, res, next);

      expect(req.session.swaggerAuth).toBe(true);
      expect(res.redirect).toHaveBeenCalledWith('/api-docs/');
    });
  });

  describe('Database Authentication & Lockouts', () => {
    let mockDBUser;

    beforeEach(() => {
      mockDBUser = {
        id: 'codex-uuid',
        email: 'CODEX',
        password_hash: 'hashed_password_placeholder',
        role: 'ADMIN',
        is_active: true,
        failed_login_attempts: 0,
        is_locked: false,
        lock_until: null
      };
      userModel.findByEmail.mockResolvedValue(mockDBUser);
      userModel.comparePassword.mockResolvedValue(true);
      userModel.findById.mockResolvedValue(mockDBUser);
    });

    it('should successfully authenticate using database user credentials', async () => {
      req.path = '/login';
      req.method = 'POST';
      req.body = { username: 'CODEX', password: 'MySuperSecretPassword123!', _csrf: 'mock-csrf-token' };

      await swaggerAuth(req, res, next);

      expect(userModel.findByEmail).toHaveBeenCalledWith('CODEX');
      expect(userModel.comparePassword).toHaveBeenCalledWith('MySuperSecretPassword123!', 'hashed_password_placeholder');
      expect(userModel.resetFailedAttempts).toHaveBeenCalledWith(mockDBUser, req.ip);
      expect(req.session.swaggerAuth).toBe(true);
      expect(res.redirect).toHaveBeenCalledWith('/api-docs/');
    });

    it('should increment failed attempts and lockout account when password is wrong', async () => {
      userModel.comparePassword.mockResolvedValue(false);

      req.path = '/login';
      req.method = 'POST';
      req.body = { username: 'CODEX', password: 'wrongpassword', _csrf: 'mock-csrf-token' };

      await swaggerAuth(req, res, next);

      expect(userModel.incrementAdminFailedAttempts).toHaveBeenCalledWith(mockDBUser);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.send).toHaveBeenCalledWith(expect.stringContaining('Invalid username or password'));
    });

    it('should reject login immediately if database user account is locked', async () => {
      mockDBUser.is_locked = true;
      mockDBUser.lock_until = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // locked for 15 mins

      req.path = '/login';
      req.method = 'POST';
      req.body = { username: 'CODEX', password: 'MySuperSecretPassword123!', _csrf: 'mock-csrf-token' };

      await swaggerAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.send).toHaveBeenCalledWith(expect.stringContaining('This account is temporarily locked'));
      expect(userModel.comparePassword).not.toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });

    it('should auto-unlock database account if lockout timer has expired', async () => {
      mockDBUser.is_locked = true;
      mockDBUser.lock_until = new Date(Date.now() - 1000).toISOString(); // lock expired 1 sec ago

      // Mock userModel.findById to return unlocked user state after unlock reset
      const unlockedDBUser = { ...mockDBUser, is_locked: false, lock_until: null };
      userModel.findById.mockResolvedValue(unlockedDBUser);

      req.path = '/login';
      req.method = 'POST';
      req.body = { username: 'CODEX', password: 'MySuperSecretPassword123!', _csrf: 'mock-csrf-token' };

      await swaggerAuth(req, res, next);

      expect(userModel.resetFailedAttempts).toHaveBeenCalledWith(mockDBUser);
      expect(userModel.comparePassword).toHaveBeenCalled();
      expect(req.session.swaggerAuth).toBe(true);
      expect(res.redirect).toHaveBeenCalledWith('/api-docs/');
    });
  });

  describe('Session Access Control and Timeouts', () => {
    beforeEach(() => {
      req.session.swaggerAuth = true;
      req.session.swaggerAuthLoginTime = Date.now();
      req.session.swaggerAuthLastActivity = Date.now();
    });

    it('should grant access and touch activity timestamp on valid session', async () => {
      req.path = '/index.html';
      const initialActivity = req.session.swaggerAuthLastActivity;

      // Advance time slightly
      jest.spyOn(Date, 'now').mockReturnValue(initialActivity + 5000);

      await swaggerAuth(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.session.swaggerAuthLastActivity).toBe(initialActivity + 5000);
      expect(res.redirect).not.toHaveBeenCalled();
    });

    it('should redirect to login if session has exceeded inactivity idle limit', async () => {
      req.path = '/index.html';
      const initialActivity = req.session.swaggerAuthLastActivity;

      // Idle timeout threshold is 15 minutes (900,000ms)
      jest.spyOn(Date, 'now').mockReturnValue(initialActivity + 16 * 60 * 1000);

      await swaggerAuth(req, res, next);

      expect(req.session.swaggerAuth).toBeUndefined();
      expect(res.redirect).toHaveBeenCalledWith('/api-docs/login?reason=inactive');
      expect(next).not.toHaveBeenCalled();
    });

    it('should redirect to login if session has exceeded hard session ceiling', async () => {
      req.path = '/index.html';
      const loginTime = req.session.swaggerAuthLoginTime;

      // Hard timeout limit is 2 hours (7,200,000ms)
      jest.spyOn(Date, 'now').mockReturnValue(loginTime + 3 * 60 * 60 * 1000);

      await swaggerAuth(req, res, next);

      expect(req.session.swaggerAuth).toBeUndefined();
      expect(res.redirect).toHaveBeenCalledWith('/api-docs/login?reason=expired');
      expect(next).not.toHaveBeenCalled();
    });

    it('should redirect to login if user is unauthenticated', async () => {
      delete req.session.swaggerAuth;
      req.path = '/index.html';

      await swaggerAuth(req, res, next);

      expect(res.redirect).toHaveBeenCalledWith('/api-docs/login');
      expect(next).not.toHaveBeenCalled();
    });
  });
});
