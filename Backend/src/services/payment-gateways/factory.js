const PaystackGateway = require('./paystack.gateway');

class PaymentGatewayFactory {
  /**
   * Get the concrete implementation of a payment gateway.
   * @param {string} provider - Provider name (e.g. 'paystack')
   * @returns {BaseGateway}
   */
  static getGateway(provider) {
    const formattedProvider = (provider || '').toLowerCase();
    
    if (formattedProvider === 'paystack') {
      return new PaystackGateway();
    }
    
    throw new Error(`Unsupported payment provider: ${provider}`);
  }
}

module.exports = PaymentGatewayFactory;
