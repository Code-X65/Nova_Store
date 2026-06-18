const requestTimeout = require('../../../src/middlewares/timeout.middleware');

describe('RequestTimeout Middleware', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    jest.useFakeTimers();
    req = {
      originalUrl: '/api/v1/products'
    };
    res = {
      headersSent: false,
      on: jest.fn()
    };
    next = jest.fn();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should call next immediately to continue pipeline', () => {
    requestTimeout(5000)(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    // Timeout should not have fired yet
    expect(next).not.toHaveBeenCalledWith(expect.any(Error));
  });

  it('should trigger timeout error if request hangs beyond limit', () => {
    const middleware = requestTimeout(5000);
    middleware(req, res, next);
    
    // Fast-forward timers
    jest.advanceTimersByTime(5000);

    expect(next).toHaveBeenCalledTimes(2); // First on start, second on timeout
    const timeoutErr = next.mock.calls[1][0];
    expect(timeoutErr).toBeDefined();
    expect(timeoutErr.statusCode).toBe(503);
    expect(timeoutErr.message).toBe('Request Timeout');
  });

  it('should not trigger timeout if headers are already sent', () => {
    const middleware = requestTimeout(5000);
    middleware(req, res, next);

    res.headersSent = true;
    jest.advanceTimersByTime(5000);

    expect(next).toHaveBeenCalledTimes(1); // Only the initial call
  });

  it('should bypass timeout check for exempted upload paths', () => {
    req.originalUrl = '/api/v1/uploads/image.png';
    const middleware = requestTimeout(5000);
    middleware(req, res, next);

    jest.advanceTimersByTime(5000);

    expect(next).toHaveBeenCalledTimes(1); // Only initial next()
  });

  it('should bypass timeout check for exempted webhook paths', () => {
    req.originalUrl = '/api/v1/payments/webhooks/paystack';
    const middleware = requestTimeout(5000);
    middleware(req, res, next);

    jest.advanceTimersByTime(5000);

    expect(next).toHaveBeenCalledTimes(1); // Only initial next()
  });
});
