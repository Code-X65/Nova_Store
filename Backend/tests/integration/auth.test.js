const request = require('supertest');
const app = require('../../src/app');

jest.setTimeout(15000);

// Mock models and third-party libraries used in the test
jest.mock('../../src/models/user.model');
jest.mock('../../src/models/token.model');
jest.mock('../../src/models/session.model');
jest.mock('../../src/models/user-role.model');
jest.mock('../../src/models/permission.model');
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
    },
    referralSource: 'facebook'
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

    it('should fail registration if referralSource is missing', async () => {
      const payload = { ...testUser };
      delete payload.referralSource;

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send(payload);

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Validation failed');
    });

    it('should fail registration if referralSource is other and referralSourceOther is missing', async () => {
      const payload = { ...testUser, referralSource: 'other' };
      delete payload.referralSourceOther;

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send(payload);

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Validation failed');
    });

    it('should succeed registration if referralSource is other and referralSourceOther is provided', async () => {
      const userModel = require('../../src/models/user.model');
      userModel.findByEmail.mockResolvedValue(null);
      userModel.create.mockResolvedValue({ id: 'user-123', ...testUser, referral_source: 'other', referral_source_other: 'Billboard' });

      const payload = { ...testUser, referralSource: 'other', referralSourceOther: 'Billboard' };

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send(payload);

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('should link referrer when valid referredByCode is provided', async () => {
      const userModel = require('../../src/models/user.model');
      userModel.findByEmail.mockResolvedValue(null);
      userModel.findByReferralCode.mockResolvedValue({ id: 'referrer-456', email: 'referrer@example.com', loyalty_points: 100 });
      userModel.findById.mockResolvedValue({ id: 'referrer-456', first_name: 'Referrer', last_name: 'User' });
      userModel.create.mockResolvedValue({ id: 'user-123', ...testUser });
      userModel.update.mockResolvedValue({});

      const payload = { ...testUser, referredByCode: 'ABCDEF123456' };

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send(payload);

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(userModel.findByReferralCode).toHaveBeenCalledWith('ABCDEF123456');
      expect(userModel.update).toHaveBeenCalledWith('user-123', { referred_by: 'referrer-456' });
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

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      // Verify that the session cookie and refresh token cookies are set
      expect(res.headers['set-cookie']).toBeDefined();
      const cookies = res.headers['set-cookie'];
      expect(cookies.some(c => c.startsWith('connect.sid=') || c.startsWith('refreshToken='))).toBe(true);
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

  describe('Phone Verification Endpoints', () => {
    it('should send phone OTP successfully', async () => {
      const phoneVerificationModel = require('../../src/models/phone_verification.model');
      const smsService = require('../../src/services/sms.service');

      phoneVerificationModel.createPhoneVerificationToken.mockResolvedValue({ id: 'token-123' });
      smsService.send.mockResolvedValue({ success: true, messageId: 'sms-123' });

      const res = await request(app)
        .post('/api/v1/auth/send-phone-otp')
        .send({
          userId: '519d0bc0-5f3a-4084-8e88-b61f70676335',
          phoneNumber: '2349159003847',
          phoneCountryCode: '234'
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('OTP sent to 234 2349159003847');
      expect(phoneVerificationModel.createPhoneVerificationToken).toHaveBeenCalled();
    });

    it('should verify phone OTP successfully', async () => {
      const phoneVerificationModel = require('../../src/models/phone_verification.model');
      const userModel = require('../../src/models/user.model');

      const mockTokenRecord = {
        id: 'token-123',
        user_id: '519d0bc0-5f3a-4084-8e88-b61f70676335',
        token: 'hashed_otp',
        phone_number: '2349159003847',
        expires_at: new Date(Date.now() + 100000).toISOString(),
        used: false,
        attempt_count: 0
      };

      phoneVerificationModel.findByPhoneToken.mockResolvedValue(mockTokenRecord);
      phoneVerificationModel.markAsUsed.mockResolvedValue({});
      userModel.update.mockResolvedValue({});

      const res = await request(app)
        .post('/api/v1/auth/verify-phone')
        .send({
          userId: '519d0bc0-5f3a-4084-8e88-b61f70676335',
          otp: '123456'
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isPhoneVerified).toBe(true);
      expect(phoneVerificationModel.findByPhoneToken).toHaveBeenCalled();
      expect(phoneVerificationModel.markAsUsed).toHaveBeenCalledWith('token-123');
      expect(userModel.update).toHaveBeenCalledWith('519d0bc0-5f3a-4084-8e88-b61f70676335', { is_phone_verified: true });
    });

    it('should resend phone OTP successfully', async () => {
      const phoneVerificationModel = require('../../src/models/phone_verification.model');
      const userModel = require('../../src/models/user.model');
      const smsService = require('../../src/services/sms.service');

      const mockTokenRecord = {
        id: 'token-123',
        user_id: '519d0bc0-5f3a-4084-8e88-b61f70676335',
        used: false
      };
      const mockUser = {
        id: '519d0bc0-5f3a-4084-8e88-b61f70676335',
        phone_number: '9159003847',
        phone_country_code: '234'
      };

      phoneVerificationModel.findLatestByUserId.mockResolvedValue(mockTokenRecord);
      phoneVerificationModel.markAsUsed.mockResolvedValue({});
      userModel.findById.mockResolvedValue(mockUser);
      smsService.send.mockResolvedValue({ success: true, messageId: 'sms-123' });

      const res = await request(app)
        .post('/api/v1/auth/resend-phone-otp')
        .send({
          userId: '519d0bc0-5f3a-4084-8e88-b61f70676335'
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('OTP resent successfully');
      expect(phoneVerificationModel.findLatestByUserId).toHaveBeenCalledWith('519d0bc0-5f3a-4084-8e88-b61f70676335');
      expect(phoneVerificationModel.markAsUsed).toHaveBeenCalledWith('token-123');
      expect(userModel.findById).toHaveBeenCalledWith('519d0bc0-5f3a-4084-8e88-b61f70676335');
      expect(smsService.send).toHaveBeenCalled();
    });
  });

  describe('POST /api/v1/auth/set-password', () => {
    it('should return 401 if unauthenticated', async () => {
      const res = await request(app)
        .post('/api/v1/auth/set-password')
        .send({
          password: 'NewSecurePass123!',
          confirmPassword: 'NewSecurePass123!'
        });

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Not authorized');
    });

    it('should return 400 if validation fails', async () => {
      const jwt = require('jsonwebtoken');
      const userModel = require('../../src/models/user.model');
      const userRoleModel = require('../../src/models/user-role.model');
      const permissionModel = require('../../src/models/permission.model');

      jwt.verify.mockReturnValue({ id: '519d0bc0-5f3a-4084-8e88-b61f70676335' });
      userModel.findById.mockResolvedValue({ id: '519d0bc0-5f3a-4084-8e88-b61f70676335' });
      userRoleModel.getUserRoles.mockResolvedValue([]);
      permissionModel.getUserPermissions.mockResolvedValue([]);

      const res = await request(app)
        .post('/api/v1/auth/set-password')
        .set('Authorization', 'Bearer valid-token')
        .send({
          password: 'weak',
          confirmPassword: 'mismatch'
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toBeDefined();
    });

    it('should set password successfully for OAuth users without a password', async () => {
      const jwt = require('jsonwebtoken');
      const userModel = require('../../src/models/user.model');
      const sessionModel = require('../../src/models/session.model');
      const bcrypt = require('bcrypt');
      const userRoleModel = require('../../src/models/user-role.model');
      const permissionModel = require('../../src/models/permission.model');

      // Setup JWT mock
      jwt.verify.mockReturnValue({ id: '519d0bc0-5f3a-4084-8e88-b61f70676335' });

      // Mock user lookup inside protect middleware and controller
      const mockUser = {
        id: '519d0bc0-5f3a-4084-8e88-b61f70676335',
        email: 'oauthuser@example.com',
        role: 'USER',
        password_hash: null // OAuth user
      };
      userModel.findById.mockResolvedValue(mockUser);
      userModel.update.mockResolvedValue({});
      sessionModel.revokeAllForUser.mockResolvedValue({});
      userRoleModel.getUserRoles.mockResolvedValue([]);
      permissionModel.getUserPermissions.mockResolvedValue([]);

      bcrypt.genSalt.mockResolvedValue('salt');
      bcrypt.hash.mockResolvedValue('new_hashed_password');

      const res = await request(app)
        .post('/api/v1/auth/set-password')
        .set('Authorization', 'Bearer valid-token')
        .send({
          password: 'NewSecurePass123!',
          confirmPassword: 'NewSecurePass123!'
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('Password set successfully');
      expect(userModel.update).toHaveBeenCalledWith('519d0bc0-5f3a-4084-8e88-b61f70676335', {
        password_hash: 'new_hashed_password'
      });
      expect(sessionModel.revokeAllForUser).toHaveBeenCalledWith('519d0bc0-5f3a-4084-8e88-b61f70676335');
    });

    it('should return 400 if user already has a password set', async () => {
      const jwt = require('jsonwebtoken');
      const userModel = require('../../src/models/user.model');
      const userRoleModel = require('../../src/models/user-role.model');
      const permissionModel = require('../../src/models/permission.model');

      jwt.verify.mockReturnValue({ id: '519d0bc0-5f3a-4084-8e88-b61f70676335' });

      const mockUserWithPassword = {
        id: '519d0bc0-5f3a-4084-8e88-b61f70676335',
        email: 'regularuser@example.com',
        role: 'USER',
        password_hash: 'already_has_hashed_password'
      };
      userModel.findById.mockResolvedValue(mockUserWithPassword);
      userRoleModel.getUserRoles.mockResolvedValue([]);
      permissionModel.getUserPermissions.mockResolvedValue([]);

      const res = await request(app)
        .post('/api/v1/auth/set-password')
        .set('Authorization', 'Bearer valid-token')
        .send({
          password: 'NewSecurePass123!',
          confirmPassword: 'NewSecurePass123!'
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('OAuth Endpoints', () => {
    const authService = require('../../src/services/auth.service');

    describe('GET /api/v1/auth/oauth/google', () => {
      it('should redirect to Google auth URL', async () => {
        jest.spyOn(authService, 'getGoogleAuthUrl').mockReturnValue({
          url: 'https://accounts.google.com/o/oauth2/v2/auth?client_id=...',
          state: 'mocked-google-state'
        });

        const res = await request(app).get('/api/v1/auth/oauth/google');

        expect(res.statusCode).toBe(302);
        expect(res.headers.location).toContain('accounts.google.com');
        expect(res.headers['set-cookie'][0]).toContain('oauth_state=mocked-google-state');
      });
    });

    describe('GET /api/v1/auth/oauth/google/callback', () => {
      it('should login Google user and redirect to frontend', async () => {
        jest.spyOn(authService, 'googleLogin').mockResolvedValue({
          user: { id: 'user-123', is_email_verified: true, is_phone_verified: false },
          tokens: { accessToken: 'access-token', refreshToken: 'refresh-token' }
        });

        const res = await request(app)
          .get('/api/v1/auth/oauth/google/callback?code=mock-code&state=mocked-google-state')
          .set('Cookie', ['oauth_state=mocked-google-state']);

        expect(res.statusCode).toBe(302);
        expect(res.headers.location).toContain('/oauth-success');
        expect(res.headers.location).toContain('isEmailVerified=true');
        const refreshCookie = res.headers['set-cookie'].find(c => c.startsWith('refreshToken=') || c.startsWith('connect.sid='));
        expect(refreshCookie).toBeDefined();
      });

      it('should fail with invalid state (CSRF protection)', async () => {
        const res = await request(app)
          .get('/api/v1/auth/oauth/google/callback?code=mock-code&state=wrong-state')
          .set('Cookie', ['oauth_state=mocked-google-state']);

        expect(res.statusCode).toBe(403);
        expect(res.body.success).toBe(false);
        expect(res.body.error.message).toContain('Invalid OAuth state');
      });
    });

    describe('GET /api/v1/auth/oauth/facebook', () => {
      it('should redirect to Facebook auth URL', async () => {
        jest.spyOn(authService, 'getFacebookAuthUrl').mockReturnValue({
          url: 'https://www.facebook.com/v19.0/dialog/oauth?...',
          state: 'mocked-facebook-state'
        });

        const res = await request(app).get('/api/v1/auth/oauth/facebook');

        expect(res.statusCode).toBe(302);
        expect(res.headers.location).toContain('facebook.com');
        expect(res.headers['set-cookie'][0]).toContain('oauth_state=mocked-facebook-state');
      });
    });

    describe('GET /api/v1/auth/oauth/facebook/callback', () => {
      it('should login Facebook user and redirect to frontend', async () => {
        jest.spyOn(authService, 'facebookLogin').mockResolvedValue({
          user: { id: 'user-123', is_email_verified: true, is_phone_verified: true },
          tokens: { accessToken: 'access-token', refreshToken: 'refresh-token' }
        });

        const res = await request(app)
          .get('/api/v1/auth/oauth/facebook/callback?code=mock-code&state=mocked-facebook-state')
          .set('Cookie', ['oauth_state=mocked-facebook-state']);

        expect(res.statusCode).toBe(302);
        expect(res.headers.location).toContain('/oauth-success');
        expect(res.headers.location).toContain('isEmailVerified=true');
        const refreshCookie = res.headers['set-cookie'].find(c => c.startsWith('refreshToken=') || c.startsWith('connect.sid='));
        expect(refreshCookie).toBeDefined();
      });

      it('should fail with invalid state (CSRF protection)', async () => {
        const res = await request(app)
          .get('/api/v1/auth/oauth/facebook/callback?code=mock-code&state=wrong-state')
          .set('Cookie', ['oauth_state=mocked-facebook-state']);

        expect(res.statusCode).toBe(403);
        expect(res.body.success).toBe(false);
        expect(res.body.error.message).toContain('Invalid OAuth state');
      });
    });

    describe('GET /api/v1/auth/oauth/apple', () => {
      it('should redirect to Apple auth URL', async () => {
        jest.spyOn(authService, 'getAppleAuthUrl').mockReturnValue({
          url: 'https://appleid.apple.com/auth/authorize?...',
          state: 'mocked-apple-state'
        });

        const res = await request(app).get('/api/v1/auth/oauth/apple');

        expect(res.statusCode).toBe(302);
        expect(res.headers.location).toContain('appleid.apple.com');
        expect(res.headers['set-cookie'][0]).toContain('oauth_state=mocked-apple-state');
      });
    });

    describe('POST /api/v1/auth/oauth/apple/callback', () => {
      it('should login Apple user and redirect to frontend', async () => {
        jest.spyOn(authService, 'appleLogin').mockResolvedValue({
          user: { id: 'user-123', is_email_verified: true, is_phone_verified: false },
          tokens: { accessToken: 'access-token', refreshToken: 'refresh-token' }
        });

        const res = await request(app)
          .post('/api/v1/auth/oauth/apple/callback')
          .set('Cookie', ['oauth_state=mocked-apple-state'])
          .send({
            code: 'mock-code',
            id_token: 'mock-id-token',
            state: 'mocked-apple-state',
            user: '{"name":{"firstName":"Apple","lastName":"User"}}'
          });

        expect(res.statusCode).toBe(302);
        expect(res.headers.location).toContain('/oauth-success');
        expect(res.headers.location).toContain('isEmailVerified=true');
        const refreshCookie = res.headers['set-cookie'].find(c => c.startsWith('refreshToken=') || c.startsWith('connect.sid='));
        expect(refreshCookie).toBeDefined();
      });

      it('should fail with invalid state (CSRF protection)', async () => {
        const res = await request(app)
          .post('/api/v1/auth/oauth/apple/callback')
          .set('Cookie', ['oauth_state=mocked-apple-state'])
          .send({
            code: 'mock-code',
            id_token: 'mock-id-token',
            state: 'wrong-state'
          });

        expect(res.statusCode).toBe(403);
        expect(res.body.success).toBe(false);
        expect(res.body.error.message).toContain('Invalid OAuth state');
      });
    });
  });
});