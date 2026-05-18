const authService = require('../../../src/services/auth.service');
const userModel = require('../../../src/models/user.model');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

jest.mock('../../../src/models/user.model');
jest.mock('../../../src/models/session.model');
jest.mock('../../../src/models/token.model');
jest.mock('../../../src/services/email.service');
jest.mock('bcrypt');
jest.mock('jsonwebtoken');

describe('AuthService', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      password_hash: 'hashed_password',
      is_active: true,
      is_email_verified: true,
      is_locked: false,
      role: 'USER',
      failed_login_attempts: 0
    };

    it('should login successfully with correct credentials', async () => {
      userModel.findByEmail.mockResolvedValue(mockUser);
      userModel.comparePassword.mockResolvedValue(true);
      
      // Mock generateTokens part
      jwt.sign.mockReturnValue('mock_token');

      const result = await authService.login('test@example.com', 'password123');

      expect(result.user).toEqual(mockUser);
      expect(result.tokens).toBeDefined();
      expect(userModel.findByEmail).toHaveBeenCalledWith('test@example.com');
    });

    it('should throw error if user not found', async () => {
      userModel.findByEmail.mockResolvedValue(null);

      await expect(authService.login('wrong@example.com', 'password'))
        .rejects.toThrow('Invalid email or password');
    });

    it('should throw error if account is locked', async () => {
      const lockedUser = { ...mockUser, is_locked: true, lock_until: new Date(Date.now() + 10000).toISOString() };
      userModel.findByEmail.mockResolvedValue(lockedUser);

      await expect(authService.login('test@example.com', 'password'))
        .rejects.toThrow(/Account is locked/);
    });

    it('should throw error if email is not verified', async () => {
      const unverifiedUser = { ...mockUser, is_email_verified: false };
      userModel.findByEmail.mockResolvedValue(unverifiedUser);

      await expect(authService.login('test@example.com', 'password'))
        .rejects.toThrow(/verify your email/);
    });
  });
});
