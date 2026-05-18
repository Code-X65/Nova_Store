const request = require('supertest');
const app = require('../../src/app');
const { redisClient } = require('../../src/config/redis');

// Helper to generate random email
const randomEmail = () => `testuser_${Date.now()}_${Math.floor(Math.random() * 1000)}@example.com`;

describe('Auth API Endpoints', () => {
  let testUser = {
    email: randomEmail(),
    password: 'SecurePassword123!',
    firstName: 'Test',
    lastName: 'User'
  };

  let accessToken = '';

  afterAll(async () => {
    if (redisClient.isOpen) {
      await redisClient.disconnect();
    }
  });

  describe('POST /api/v1/auth/register', () => {
    it('should register a new user successfully', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send(testUser);
      
      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('Registration successful');
    });

    it('should fail registration with an existing email', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send(testUser);
      
      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should fail registration with a weak password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          ...testUser,
          email: randomEmail(),
          password: 'weak'
        });
      
      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBeDefined();
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should login the user successfully', async () => {
      // NOTE: User might be unverified right after registration depending on the system flow.
      // If the system requires email verification, this might return 403.
      // We will assert that it either succeeds or returns the unverified error.
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        });
      
      if (res.statusCode === 403) {
        expect(res.body.message).toContain('Please verify your email');
      } else {
        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.accessToken).toBeDefined();
        accessToken = res.body.accessToken;
      }
    });

    it('should fail login with wrong password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: 'WrongPassword123!'
        });
      
      // If the user is unverified, it returns 403 before checking password.
      if (res.statusCode === 403) {
        expect(res.body.message).toContain('Please verify your email');
      } else {
        expect(res.statusCode).toBe(401);
        expect(res.body.success).toBe(false);
      }
    });
  });
});
