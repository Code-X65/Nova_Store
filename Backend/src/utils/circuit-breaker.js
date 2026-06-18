const logger = require('./logger');

class CircuitBreaker {
  /**
   * @param {Function} action - Async function to wrap
   * @param {object} [options]
   * @param {number} [options.failureThreshold=5] - Number of failures before opening circuit
   * @param {number} [options.cooldownPeriod=30000] - Cooldown period in ms before trying again
   */
  constructor(action, options = {}) {
    this.action = action;
    this.failureThreshold = options.failureThreshold || 5;
    this.cooldownPeriod = options.cooldownPeriod || 30000;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF-OPEN
    
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttempt = Date.now();
  }

  async execute(...args) {
    if (this.state === 'OPEN') {
      if (Date.now() > this.nextAttempt) {
        this.state = 'HALF-OPEN';
        logger.info(`[CircuitBreaker] State transitioned to HALF-OPEN.`);
      } else {
        throw new Error('Circuit Breaker is OPEN. Downstream service is temporarily unavailable.');
      }
    }

    try {
      const result = await this.action(...args);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }

  onSuccess() {
    this.failureCount = 0;
    if (this.state === 'HALF-OPEN') {
      this.successCount++;
      if (this.successCount >= 2) { // Require 2 consecutive successes to close circuit
        this.state = 'CLOSED';
        this.successCount = 0;
        logger.info(`[CircuitBreaker] State transitioned to CLOSED. Downstream service is healthy.`);
      }
    }
  }

  onFailure(error) {
    this.failureCount++;
    this.successCount = 0;
    logger.warn(`[CircuitBreaker] Failure detected: "${error.message}". Count: ${this.failureCount}/${this.failureThreshold}`);

    if (this.state === 'HALF-OPEN' || this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.cooldownPeriod;
      logger.error(`[CircuitBreaker] State transitioned to OPEN. Cooldown active for ${this.cooldownPeriod}ms.`);
    }
  }
}

module.exports = CircuitBreaker;
