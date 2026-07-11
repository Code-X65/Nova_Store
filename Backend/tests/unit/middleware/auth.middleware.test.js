const { protect } = require('../../../src/middlewares/auth.middleware');
const userModel = require('../../../src/models/user.model');
const adminModel = require('../../../src/models/admin.model');
const permissionModel = require('../../../src/models/permission.model');
const userRoleModel = require('../../../src/models/user-role.model');
const jwt = require('jsonwebtoken');

jest.mock('../../../src/models/user.model');
jest.mock('../../../src/models/admin.model');
jest.mock('../../../src/models/permission.model');
jest.mock('../../../src/models/user-role.model');
jest.mock('jsonwebtoken');

describe('Auth Middleware - protect', () => {
  let req;
  let res;
  let next;

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

  describe('Session-based Admin Authentication', () => {
    it('should authenticate successfully using an active admin session', async () => {
      req.session.adminId = 'admin-uuid-123';
      const mockAdmin = {
        id: 'admin-uuid-123',
        email: 'admin@novastore.com',
        first_name: 'System',
        last_name: 'Admin',
        is_active: true
      };

      userModel.findById.mockResolvedValue(mockAdmin);
      userModel.getUserRolesAndPermissions.mockResolvedValue({
        roles: ['STORE_OWNER'],
        permissions: ['*']
      });

      await protect(req, res, next);

      expect(userModel.findById).toHaveBeenCalledWith('admin-uuid-123');
      expect(userModel.getUserRolesAndPermissions).toHaveBeenCalledWith('admin-uuid-123', expect.any(Object));
      expect(req.admin).toEqual({
        id: 'admin-uuid-123',
        email: 'admin@novastore.com',
        firstName: 'System',
        lastName: 'Admin',
        role: 'STORE_OWNER',
        roles: ['STORE_OWNER'],
        permissions: ['*'],
        hasRole: expect.any(Function)
      });
      expect(req.user).toEqual({
        id: 'admin-uuid-123',
        email: 'admin@novastore.com',
        role: 'STORE_OWNER',
        roles: ['STORE_OWNER'],
        permissions: ['*']
      });
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should fall back to token auth if admin is deactivated', async () => {
      req.session.adminId = 'admin-uuid-123';
      const mockAdmin = {
        id: 'admin-uuid-123',
        email: 'admin@novastore.com',
        is_active: false
      };

      userModel.findById.mockResolvedValue(mockAdmin);

      await protect(req, res, next);

      // Falls through to token check, fails because no authorization header
      expect(userModel.findById).toHaveBeenCalledWith('admin-uuid-123');
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        message: 'Not authorized, no token'
      }));
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('Token-based JWT Authentication', () => {
    it('should authenticate successfully using a valid Bearer JWT token', async () => {
      req.headers.authorization = 'Bearer valid-jwt-token';
      const decodedPayload = { id: 'user-uuid-456', email: 'user@example.com' };
      const mockUser = { id: 'user-uuid-456', email: 'user@example.com', is_active: true };

      jwt.verify.mockReturnValue(decodedPayload);
      userModel.findById.mockResolvedValue(mockUser);
      userRoleModel.getUserRoles.mockResolvedValue([{ name: 'customer' }]);
      permissionModel.getUserPermissions.mockResolvedValue(['product:read']);

      await protect(req, res, next);

      expect(jwt.verify).toHaveBeenCalledWith('valid-jwt-token', process.env.JWT_ACCESS_SECRET);
      expect(userModel.findById).toHaveBeenCalledWith('user-uuid-456');
      expect(req.user).toEqual({
        id: 'user-uuid-456',
        email: 'user@example.com',
        is_active: true,
        roles: ['customer'],
        permissions: ['product:read']
      });
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should return 401 if user is not found in database', async () => {
      req.headers.authorization = 'Bearer valid-jwt-token';
      jwt.verify.mockReturnValue({ id: 'non-existent-user' });
      userModel.findById.mockResolvedValue(null);

      await protect(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        message: 'Not authorized, user not found'
      }));
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 if token verification fails', async () => {
      req.headers.authorization = 'Bearer invalid-token';
      jwt.verify.mockImplementation(() => {
        throw new Error('jwt expired');
      });

      await protect(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        message: 'Not authorized, token failed'
      }));
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('No Authentication Credentials Provided', () => {
    it('should return 401 if neither session nor bearer token are provided', async () => {
      await protect(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        message: 'Not authorized, no token'
      }));
      expect(next).not.toHaveBeenCalled();
    });
  });
});
