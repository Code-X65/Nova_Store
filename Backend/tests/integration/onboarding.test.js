const request = require('supertest');
const app = require('../../src/app');

jest.setTimeout(20000);

const userModel = require('../../src/models/user.model');
const onboardingModel = require('../../src/models/onboarding.model');
const userRoleModel = require('../../src/models/user-role.model');
const permissionModel = require('../../src/models/permission.model');
const jwt = require('jsonwebtoken');

jest.mock('../../src/models/user.model');
jest.mock('../../src/models/onboarding.model');
jest.mock('../../src/models/user-role.model');
jest.mock('../../src/models/permission.model');
jest.mock('jsonwebtoken');

describe('Onboarding API Endpoints', () => {
  let testUser = {
    id: 'user-onboard-123',
    email: 'onboard@example.com',
    firstName: 'Onboard',
    lastName: 'User'
  };

  let accessToken = 'mock-access-token';

  beforeAll(() => {
    // Mock jwt.verify to return decoded user payload
    jwt.verify.mockReturnValue({ id: testUser.id });

    // Mock userModel.findById
    userModel.findById.mockResolvedValue({
      id: testUser.id,
      email: testUser.email,
      first_name: testUser.firstName,
      last_name: testUser.lastName,
      onboarding_status: 'not_started',
    });

    // Mock roles/permissions
    userRoleModel.getUserRoles.mockResolvedValue([]);
    permissionModel.getUserPermissions.mockResolvedValue([]);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/v1/onboarding/status', () => {
    it('should return 401 if unauthorized', async () => {
      // Temporarily make jwt.verify throw to simulate unauthorized
      jwt.verify.mockImplementationOnce(() => {
        throw new Error('Invalid token');
      });

      const res = await request(app).get('/api/v1/onboarding/status');
      expect(res.statusCode).toBe(401);
    });

    it('should return onboarding status if authorized', async () => {
      jwt.verify.mockReturnValue({ id: testUser.id });
      onboardingModel.getStatus.mockResolvedValue({
        status: 'not_started',
        progress: 0,
      });

      const res = await request(app)
        .get('/api/v1/onboarding/status')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual({
        status: 'not_started',
        progress: 0,
      });
    });
  });
});
