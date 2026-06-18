const jwt = require('jsonwebtoken');
const { protect } = require('../../src/middlewares/auth.middleware');
const userModel = require('../../src/models/user.model');
const userRoleModel = require('../../src/models/user-role.model');
const permissionModel = require('../../src/models/permission.model');

jest.mock('../../src/models/user.model');
jest.mock('../../src/models/user-role.model');
jest.mock('../../src/models/permission.model');

describe('Auth Middleware - Unit Tests', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      headers: {},
      session: {}
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe('protect middleware', () => {
    it('should authenticate user with valid Bearer token', async () => {
      process.env.JWT_ACCESS_SECRET = 'primary_secret,rotated_secret';
      
      const payload = { id: 'user-uuid' };
      const token = jwt.sign(payload, 'primary_secret', { expiresIn: '15m' });
      
      req.headers.authorization = `Bearer ${token}`;
      
      const mockUser = { id: 'user-uuid', email: 'user@example.com', is_active: true };
      userModel.findById.mockResolvedValueOnce(mockUser);
      userRoleModel.getUserRoles.mockResolvedValueOnce([{ name: 'USER' }]);
      permissionModel.getUserPermissions.mockResolvedValueOnce(['product:read']);

      await protect(req, res, next);

      expect(userModel.findById).toHaveBeenCalledWith('user-uuid');
      expect(req.user).toEqual(expect.objectContaining({
        id: 'user-uuid',
        roles: ['USER'],
        permissions: ['product:read']
      }));
      expect(next).toHaveBeenCalled();
    });

    it('should authenticate user using rotated secret (JWT rotation)', async () => {
      process.env.JWT_ACCESS_SECRET = 'primary_secret,rotated_secret';
      
      const payload = { id: 'user-uuid-rotated' };
      const token = jwt.sign(payload, 'rotated_secret', { expiresIn: '15m' });
      
      req.headers.authorization = `Bearer ${token}`;
      
      const mockUser = { id: 'user-uuid-rotated', email: 'rotated@example.com', is_active: true };
      userModel.findById.mockResolvedValueOnce(mockUser);
      userRoleModel.getUserRoles.mockResolvedValueOnce([{ name: 'USER' }]);
      permissionModel.getUserPermissions.mockResolvedValueOnce(['product:read']);

      await protect(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user.id).toBe('user-uuid-rotated');
    });

    it('should return 401 when token is expired', async () => {
      process.env.JWT_ACCESS_SECRET = 'primary_secret';
      
      const payload = { id: 'user-uuid' };
      const token = jwt.sign(payload, 'primary_secret', { expiresIn: '-1s' });
      
      req.headers.authorization = `Bearer ${token}`;

      await protect(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        message: expect.stringContaining('Not authorized')
      }));
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 when no token is provided', async () => {
      await protect(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });
  });
});
