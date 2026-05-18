const maintenanceMiddleware = require('../../../src/middlewares/maintenance.middleware');
const SettingModel = require('../../../src/models/setting.model');

jest.mock('../../../src/models/setting.model');

describe('MaintenanceMiddleware', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    req = {
      path: '/api/v1/products',
      user: null
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  it('should call next if maintenance mode is disabled', async () => {
    SettingModel.getByKey.mockResolvedValue({ value: 'false' });

    await maintenanceMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should block non-admins with 503 if maintenance mode is enabled', async () => {
    SettingModel.getByKey.mockImplementation(async (key) => {
      if (key === 'maintenance_mode') return { value: 'true' };
      if (key === 'maintenance_message') return { value: 'Under maintenance' };
      return null;
    });

    await maintenanceMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      isMaintenance: true,
      message: 'Under maintenance'
    }));
    expect(next).not.toHaveBeenCalled();
  });

  it('should bypass maintenance mode for legacy admin role', async () => {
    SettingModel.getByKey.mockResolvedValue({ value: 'true' });
    req.user = { role: 'ADMIN' };

    await maintenanceMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should bypass maintenance mode for new RBAC admin role', async () => {
    SettingModel.getByKey.mockResolvedValue({ value: 'true' });
    req.user = { roles: ['admin'] };

    await maintenanceMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should allow login route through maintenance mode', async () => {
    SettingModel.getByKey.mockResolvedValue({ value: 'true' });
    req.path = '/api/v1/auth/login';

    await maintenanceMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should block register route during maintenance mode', async () => {
    SettingModel.getByKey.mockImplementation(async (key) => {
      if (key === 'maintenance_mode') return { value: 'true' };
      if (key === 'maintenance_message') return { value: 'Under maintenance' };
      return null;
    });
    req.path = '/api/v1/auth/register';

    await maintenanceMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(next).not.toHaveBeenCalled();
  });
});
