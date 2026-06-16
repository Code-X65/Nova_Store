const idempotencyMiddleware = require('../../../src/middlewares/idempotency.middleware');
const { idempotencyStore } = require('../../../src/utils/idempotency-store');

jest.mock('../../../src/utils/idempotency-store', () => {
  const original = jest.requireActual('../../../src/utils/idempotency-store');
  return {
    ...original,
    idempotencyStore: {
      lock: jest.fn(),
      resolve: jest.fn(),
      release: jest.fn()
    }
  };
});

describe('IdempotencyMiddleware', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    req = {
      headers: {},
      method: 'POST',
      body: { items: [{ id: 1, quantity: 2 }] },
      path: '/api/v1/checkout',
      on: jest.fn()
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      statusCode: 200,
      headersSent: false
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  it('should bypass idempotency check if header is missing', async () => {
    await idempotencyMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(idempotencyStore.lock).not.toHaveBeenCalled();
  });

  it('should bypass idempotency check if HTTP method is not mutating (e.g. GET)', async () => {
    req.headers['idempotency-key'] = 'valid-key-length-long-enough';
    req.method = 'GET';

    await idempotencyMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(idempotencyStore.lock).not.toHaveBeenCalled();
  });

  it('should return 400 if idempotency key is too short', async () => {
    req.headers['idempotency-key'] = 'short';

    await idempotencyMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      error: expect.objectContaining({
        message: expect.stringContaining('Invalid Idempotency-Key')
      })
    }));
    expect(next).not.toHaveBeenCalled();
  });

  it('should proceed and intercept response on successful lock', async () => {
    req.headers['idempotency-key'] = 'valid-key-123456789';
    idempotencyStore.lock.mockResolvedValue({ status: 'new' });

    await idempotencyMiddleware(req, res, next);

    expect(idempotencyStore.lock).toHaveBeenCalledWith(
      'valid-key-123456789',
      expect.any(String),
      null,
      '/api/v1/checkout',
      'POST',
      86400
    );
    expect(next).toHaveBeenCalled();

    // Trigger response interception
    const testPayload = { success: true, orderId: 100 };
    res.json(testPayload);

    expect(idempotencyStore.resolve).toHaveBeenCalledWith(
      'valid-key-123456789',
      200,
      testPayload,
      86400
    );
  });

  it('should return 409 Conflict if request is already in progress', async () => {
    req.headers['idempotency-key'] = 'valid-key-123456789';
    idempotencyStore.lock.mockResolvedValue({ status: 'started' });

    await idempotencyMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      error: expect.objectContaining({
        message: 'An identical request is currently in progress.'
      })
    }));
    expect(next).not.toHaveBeenCalled();
  });

  it('should return cached response if key is already completed', async () => {
    req.headers['idempotency-key'] = 'valid-key-123456789';
    const bodyHash = require('../../../src/utils/idempotency-store').hashRequestBody(req.body);
    
    idempotencyStore.lock.mockResolvedValue({
      status: 'completed',
      requestBodyHash: bodyHash,
      responseStatus: 201,
      responseBody: { success: true, orderId: 42 }
    });

    await idempotencyMiddleware(req, res, next);

    expect(res.set).toHaveBeenCalledWith('Idempotency-Replay', 'true');
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ success: true, orderId: 42 });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 400 if completed body hash does not match current request', async () => {
    req.headers['idempotency-key'] = 'valid-key-123456789';
    
    idempotencyStore.lock.mockResolvedValue({
      status: 'completed',
      requestBodyHash: 'different-hash',
      responseStatus: 201,
      responseBody: { success: true }
    });

    await idempotencyMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      error: expect.objectContaining({
        message: expect.stringContaining('Idempotency-Key mismatch')
      })
    }));
    expect(next).not.toHaveBeenCalled();
  });

  it('should release lock and not cache response on server errors (>= 500)', async () => {
    req.headers['idempotency-key'] = 'valid-key-123456789';
    idempotencyStore.lock.mockResolvedValue({ status: 'new' });

    await idempotencyMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();

    // Trigger internal server error response
    res.statusCode = 500;
    res.json({ error: 'Database crash' });

    expect(idempotencyStore.resolve).not.toHaveBeenCalled();
    expect(idempotencyStore.release).toHaveBeenCalledWith('valid-key-123456789');
  });
});
