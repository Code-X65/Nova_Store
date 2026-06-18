const CircuitBreaker = require('../../../src/utils/circuit-breaker');
const logger = require('../../../src/utils/logger');

jest.mock('../../../src/utils/logger');

describe('CircuitBreaker - Unit Tests', () => {
  let mockAction;

  beforeEach(() => {
    mockAction = jest.fn();
    jest.clearAllMocks();
  });

  it('should execute successfully in CLOSED state', async () => {
    mockAction.mockResolvedValueOnce('success-value');
    const breaker = new CircuitBreaker(mockAction, { failureThreshold: 2 });

    const result = await breaker.execute('arg1');

    expect(result).toBe('success-value');
    expect(mockAction).toHaveBeenCalledWith('arg1');
    expect(breaker.state).toBe('CLOSED');
  });

  it('should transition to OPEN after reaching the failure threshold', async () => {
    mockAction.mockRejectedValue(new Error('API failure'));
    const breaker = new CircuitBreaker(mockAction, { failureThreshold: 2, cooldownPeriod: 1000 });

    // Failure 1
    await expect(breaker.execute()).rejects.toThrow('API failure');
    expect(breaker.state).toBe('CLOSED');

    // Failure 2 -> trips
    await expect(breaker.execute()).rejects.toThrow('API failure');
    expect(breaker.state).toBe('OPEN');
    expect(breaker.failureCount).toBe(2);
  });

  it('should block execution immediately when in OPEN state', async () => {
    const breaker = new CircuitBreaker(mockAction, { failureThreshold: 1, cooldownPeriod: 5000 });
    mockAction.mockRejectedValueOnce(new Error('api error'));

    // Trip the breaker
    await expect(breaker.execute()).rejects.toThrow('api error');
    expect(breaker.state).toBe('OPEN');

    // Next request should fail fast without running action
    await expect(breaker.execute()).rejects.toThrow('Circuit Breaker is OPEN');
    expect(mockAction).toHaveBeenCalledTimes(1); // action not called again
  });

  it('should transition to HALF-OPEN and close on success', async () => {
    const breaker = new CircuitBreaker(mockAction, { failureThreshold: 1, cooldownPeriod: 50 });
    mockAction.mockRejectedValueOnce(new Error('api error'));

    // Trip
    await expect(breaker.execute()).rejects.toThrow('api error');
    expect(breaker.state).toBe('OPEN');

    // Wait for cooldown
    await new Promise(resolve => setTimeout(resolve, 60));

    // Next call: state is HALF-OPEN. Action succeeds.
    mockAction.mockResolvedValueOnce('success-after-cooldown');
    const res1 = await breaker.execute();
    expect(res1).toBe('success-after-cooldown');
    expect(breaker.state).toBe('HALF-OPEN');

    // Second success: closes the breaker
    mockAction.mockResolvedValueOnce('success-2');
    const res2 = await breaker.execute();
    expect(res2).toBe('success-2');
    expect(breaker.state).toBe('CLOSED');
  });
});
