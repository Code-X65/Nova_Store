const csrfProtection = require('../../../src/middlewares/csrf.middleware');
const logger = require('../../../src/utils/logger');

jest.mock('../../../src/utils/logger');

describe('CSRF Protection Middleware - Unit Tests', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    req = {
      method: 'POST',
      headers: {},
      session: {
        csrfToken: 'test-session-csrf-token'
      },
      originalUrl: '/api/v1/checkout'
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  it('should initialize a CSRF token in the session if missing', () => {
    req.session = {};
    req.method = 'GET';

    csrfProtection(req, res, next);

    expect(req.session.csrfToken).toBeDefined();
    expect(req.session.csrfToken.length).toBe(64); // randomBytes(32) in hex is 64 chars
    expect(next).toHaveBeenCalledWith();
  });

  it('should pass through safe methods (GET, HEAD, OPTIONS)', () => {
    const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
    safeMethods.forEach((method) => {
      req.method = method;
      next.mockClear();

      csrfProtection(req, res, next);
      expect(next).toHaveBeenCalledWith();
    });
  });

  it('should exempt Bearer JWT token authenticated requests and log it', () => {
    req.headers.authorization = 'Bearer valid-jwt-token';

    csrfProtection(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(logger.info).toHaveBeenCalledWith(
      'CSRF Check Exempted: Bearer token auth used',
      expect.objectContaining({ method: 'POST', url: '/api/v1/checkout' })
    );
  });

  it('should block cookie session request if x-csrf-token is missing', () => {
    req.session.userId = 'user-uuid-123';

    csrfProtection(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err).toBeDefined();
    expect(err.statusCode).toBe(403);
    expect(err.message).toBe('Invalid or missing CSRF token');
  });

  it('should block cookie session request if x-csrf-token does not match sessionToken', () => {
    req.session.userId = 'user-uuid-123';
    req.headers['x-csrf-token'] = 'wrong-token';

    csrfProtection(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err).toBeDefined();
    expect(err.statusCode).toBe(403);
  });

  it('should pass cookie session request if x-csrf-token matches sessionToken', () => {
    req.session.userId = 'user-uuid-123';
    req.headers['x-csrf-token'] = 'test-session-csrf-token';

    csrfProtection(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(next).not.toHaveBeenCalledWith(expect.any(Error));
  });

  it('should exempt state-modifying requests if no active cookie-based session is present', () => {
    // No userId or adminId in session
    csrfProtection(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(logger.info).toHaveBeenCalledWith(
      'CSRF Check Exempted: No active session cookie',
      expect.objectContaining({ method: 'POST', url: '/api/v1/checkout' })
    );
  });
});
