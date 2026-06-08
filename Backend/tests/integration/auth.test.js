const request = require('supertest');
const app = require('../../src/app');

// Mock models and third-party libraries used in the test
jest.mock('../../src/models/user.model');
jest.mock('../../src/models/token.model');
jest.mock('../../src/models/session.model');
jest.mock('bcrypt');
jest.mock('jsonwebtoken');

// Helper to generate random email
const randomEmail = () => `testuser_${Date.now()}_${Math.floor(Math.random() * 1000)}@example.com`;

describe('Auth API Endpoints', () => {
  let testUser = {
    email: randomEmail(),
    password: 'SecurePassword123!',
    confirmPassword: 'SecurePassword123!',
    firstName: 'Test',
    lastName: 'User',
    phoneNumber: '1234567890',
    phoneCountryCode: '+1',
    homeAddress: {
      street: '123 Main St',
      city: 'Boston',
      state: 'MA',
      postalCode: '02108',
      country: 'USA'
    }
  };

  let accessToken = '';

  afterAll(async () => {
    // Note: redisClient is mocked, so we don't need to disconnect
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/v1/auth/register', () => {
    it('should register a new user successfully', async () => {
      const userModel = require('../../src/models/user.model');
      const tokenModel = require('../../src/models/token.model');
      const bcrypt = require('bcrypt');
      const crypto = require('crypto');
      const emailService = require('../../src/services/email.service');

      // Mock userModel.findByEmail to return null (no existing user)
      userModel.findByEmail.mockResolvedValue(null);
      // Mock userModel.create to return a user object
      const createdUser = { id: 'user-123', ...testUser, password_hash: 'hashed_password' };
      userModel.create.mockResolvedValue(createdUser);
      // Mock bcrypt.genSalt and hash
      bcrypt.genSalt.mockResolvedValue('salt');
      bcrypt.hash.mockResolvedValue('hashed_password');
      // Mock crypto.randomBytes and createHash for verification token
      jest.spyOn(crypto, 'randomBytes').mockReturnValue({
        toString: jest.fn().mockReturnValue('randomToken'),
      });
      jest.spyOn(crypto, 'createHash').mockReturnValue({
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue('hashedToken'),
      });

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send(testUser);

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('Registration successful');
      // Verify that the user was created
      expect(userModel.create).toHaveBeenCalled();
      // Verify that the verification token was created
      expect(tokenModel.createVerificationToken).toHaveBeenCalled();
      // Verify that the verification email was sent
      expect(emailService.sendVerificationEmail).toHaveBeenCalled();
    });

    it('should fail registration with an existing email', async () => {
      const userModel = require('../../src/models/user.model');

      // Mock userModel.findByEmail to return an existing user
      userModel.findByEmail.mockResolvedValue({ id: 'existing-user', email: testUser.email });

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send(testUser);

      expect(res.statusCode).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Email already registered');
    });

    it('should fail registration with a weak password', async () => {
      const userModel = require('../../src/models/user.model');

      // Mock userModel.findByEmail to return null (no existing user)
      userModel.findByEmail.mockResolvedValue(null);
      // Mock userModel.create to throw a validation error (simulating Joi validation)
      const validationError = new Error('Password must be at least 12 characters long. Password must contain at least one lowercase letter, one uppercase letter, one number and one special character');
      validationError.statusCode = 400;
      userModel.create.mockRejectedValue(validationError);

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          ...testUser,
          email: randomEmail(),
          password: 'weak',
          confirmPassword: 'weak'
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toBeDefined();
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should login the user successfully', async () => {
      const userModel = require('../../src/models/user.model');
      const bcrypt = require('bcrypt');
      const jwt = require('jsonwebtoken');
      const sessionModel = require('../../src/models/session.model');

      // Mock userModel.findByEmail to return a user
      const mockUser = {
        id: 'user-123',
        email: testUser.email,
        password_hash: 'hashed_password',
        is_active: true,
        is_email_verified: true,
        is_locked: false,
        role: 'USER',
        failed_login_attempts: 0
      };
      userModel.findByEmail.mockResolvedValue(mockUser);
      // Mock userModel.comparePassword to return true (password matches)
      userModel.comparePassword.mockResolvedValue(true);
      // Mock jwt.sign to return tokens
      jwt.sign.mockImplementation((payload, secret, options) => {
        if (options.expiresIn === '15m') return 'accessToken';
        if (options.expiresIn === '30d') return 'refreshToken';
      });
      // Mock sessionModel.create
      sessionModel.create.mockResolvedValue();

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        });

      // Since the user is verified, we expect a 200
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.accessToken).toBeDefined();
      accessToken = res.body.accessToken;
      // Verify that the refresh token cookie is set
      expect(res.headers['set-cookie']).toBeDefined();
    });

    it('should fail login with wrong password', async () => {
      const userModel = require('../../src/models/user.model');
      const bcrypt = require('bcrypt');

      // Mock userModel.findByEmail to return a user
      const mockUser = {
        id: 'user-123',
        email: testUser.email,
        password_hash: 'hashed_password',
        is_active: true,
        is_email_verified: true,
        is_locked: false,
        role: 'USER',
        failed_login_attempts: 0
      };
      userModel.findByEmail.mockResolvedValue(mockUser);
      // Mock userModel.comparePassword to return false (password does not match)
      userModel.comparePassword.mockResolvedValue(false);

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: 'WrongPassword123!'
        });

      // Since the user is verified but password is wrong, we expect 401
      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should return 403 if email is not verified', async () => {
      const userModel = require('../../src/models/user.model');

      // Mock userModel.findByEmail to return an unverified user
      const unverifiedUser = {
        id: 'user-123',
        email: testUser.email,
        password_hash: 'hashed_password',
        is_active: true,
        is_email_verified: false, // Not verified
        is_locked: false,
        role: 'USER',
        failed_login_attempts: 0
      };
      userModel.findByEmail.mockResolvedValue(unverifiedUser);
      // We don't need to mock bcrypt.compare because the function will throw before checking password

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        });

      expect(res.statusCode).toBe(403);
      expect(res.body.error.message).toContain('Please verify your email');
    });
  });
});