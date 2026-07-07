const request = require('supertest');
const app = require('../../src/app');
const jwt = require('jsonwebtoken');

// Mock models, services and config
jest.mock('../../src/models/user.model');
jest.mock('../../src/models/user-role.model');
jest.mock('../../src/models/permission.model');
jest.mock('../../src/services/order.service');
jest.mock('jsonwebtoken');

const userModel = require('../../src/models/user.model');
const userRoleModel = require('../../src/models/user-role.model');
const permissionModel = require('../../src/models/permission.model');
const orderService = require('../../src/services/order.service');

describe('Order Bulk and Guest claim Integration Tests', () => {
  const mockUser = {
    id: 'user-uuid-111',
    email: 'testuser@example.com',
    is_active: true
  };
  const accessToken = 'mock-token';

  beforeEach(() => {
    jest.clearAllMocks();
    jwt.verify.mockReturnValue({ id: mockUser.id });
    userModel.findById.mockResolvedValue(mockUser);
    userRoleModel.getUserRoles.mockResolvedValue([{ name: 'customer' }]);
    permissionModel.getUserPermissions.mockResolvedValue(['order:read']);
  });

  describe('POST /api/v1/orders/claim-guest-orders', () => {
    it('should successfully claim guest orders', async () => {
      const mockClaimed = [
        { id: 'order-1', order_number: 'NS-10001', customer_email: mockUser.email }
      ];
      orderService.claimGuestOrders.mockResolvedValue(mockClaimed);

      const res = await request(app)
        .post('/api/v1/orders/claim-guest-orders')
        .set('Authorization', `Bearer ${accessToken}`)
        .send();

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.claimedCount).toBe(1);
      expect(res.body.data.orders).toEqual(mockClaimed);
      expect(orderService.claimGuestOrders).toHaveBeenCalledWith(mockUser.id, mockUser.email, expect.any(Object), undefined);
    });

    it('should return error if service fails', async () => {
      orderService.claimGuestOrders.mockRejectedValue(new Error('Please verify your email address before claiming guest orders'));

      const res = await request(app)
        .post('/api/v1/orders/claim-guest-orders')
        .set('Authorization', `Bearer ${accessToken}`)
        .send();

      expect(res.statusCode).toBe(500); // generic error handler statusCode fallback
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toBe('Please verify your email address before claiming guest orders');
    });
  });

  describe('POST /api/v1/orders/admin/bulk-action', () => {
    const validBody = {
      orderIds: ['d3b07384-d113-4956-a5db-86c5b1523401', 'd3b07384-d113-4956-a5db-86c5b1523402'],
      action: 'pack',
      extraData: { note: 'Packed carefully' }
    };

    it('should reject requests without order staff role', async () => {
      userRoleModel.getUserRoles.mockResolvedValue([{ name: 'INVENTORY_STAFF' }]);
      permissionModel.getUserPermissions.mockResolvedValue(['order:read']);

      const res = await request(app)
        .post('/api/v1/orders/admin/bulk-action')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(validBody);

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Order staff access required.');
    });

    it('should accept request and call service if user has order staff role', async () => {
      userRoleModel.getUserRoles.mockResolvedValue([{ name: 'ORDER_STAFF' }]);
      permissionModel.getUserPermissions.mockResolvedValue(['order:write']);
      const mockResult = {
        successCount: 2,
        failureCount: 0,
        successes: ['d3b07384-d113-4956-a5db-86c5b1523401', 'd3b07384-d113-4956-a5db-86c5b1523402'],
        failures: []
      };
      orderService.bulkOrderAction.mockResolvedValue(mockResult);

      const res = await request(app)
        .post('/api/v1/orders/admin/bulk-action')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(validBody);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(mockResult);
      expect(orderService.bulkOrderAction).toHaveBeenCalledWith(
        validBody.orderIds,
        validBody.action,
        validBody.extraData,
        mockUser.id,
        expect.any(Object),
        undefined
      );
    });

    it('should fail Joi validation if action is invalid', async () => {
      userRoleModel.getUserRoles.mockResolvedValue([{ name: 'ORDER_STAFF' }]);
      permissionModel.getUserPermissions.mockResolvedValue(['order:write']);

      const res = await request(app)
        .post('/api/v1/orders/admin/bulk-action')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          orderIds: ['d3b07384-d113-4956-a5db-86c5b1523401'],
          action: 'invalid_action'
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeDefined();
    });

    it('should fail Joi validation if orderIds is empty or not an array', async () => {
      userRoleModel.getUserRoles.mockResolvedValue([{ name: 'ORDER_STAFF' }]);
      permissionModel.getUserPermissions.mockResolvedValue(['order:write']);

      const res = await request(app)
        .post('/api/v1/orders/admin/bulk-action')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          orderIds: [],
          action: 'pack'
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });
});
