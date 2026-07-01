/**
 * Base abstract class defining the payment gateway contract.
 */
class BaseGateway {
  /**
   * Initialize a checkout/payment session.
   * @param {object} params - { userId, email, amount, checkoutSessionId }
   * @returns {Promise<{ authorizationUrl: string, reference: string }>}
   */
  async initialize({ userId, email, amount, checkoutSessionId }) {
    throw new Error('initialize() not implemented');
  }

  /**
   * Verify a transaction using its reference.
   * @param {string} reference
   * @returns {Promise<object>} Raw gateway transaction details
   */
  async verify(reference) {
    throw new Error('verify() not implemented');
  }

  /**
   * Verify the authenticity of a webhook signature.
   * @param {object} payload - Webhook request body
   * @param {string} signature - Signature header value
   * @returns {Promise<boolean>}
   */
  async verifySignature(payload, signature) {
    throw new Error('verifySignature() not implemented');
  }

  /**
   * Refund a transaction.
   * @param {string} reference - Gateway transaction reference
   * @param {number} amount - Refund amount
   * @param {string} reason - Reason for the refund
   * @returns {Promise<object>} Raw gateway refund response data
   */
  async refund(reference, amount, reason) {
    throw new Error('refund() not implemented');
  }
}

module.exports = BaseGateway;
