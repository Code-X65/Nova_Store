const BaseGateway = require('./base.gateway');
const SettingModel = require('../../models/setting.model');
const crypto = require('crypto');
const CircuitBreaker = require('../../utils/circuit-breaker');
const contextStore = require('../../utils/context');

const paystackRequest = async ({ url, method, body, customHeaders = {} }) => {
  const store = contextStore.getStore();
  const reqId = store?.requestId;
  
  const headers = {
    ...customHeaders
  };
  if (reqId) {
    headers['X-Request-ID'] = reqId;
    headers['traceparent'] = `00-${reqId.replace(/-/g, '')}-0000000000000001-01`;
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.message || `Paystack API returned HTTP ${response.status}`);
  }
  return result;
};

const paystackBreaker = new CircuitBreaker(paystackRequest, {
  failureThreshold: 5,
  cooldownPeriod: 30000
});

async function getPaystackSecretKey() {
  let secretKey = process.env.PAYSTACK_SECRET_KEY;
  try {
    const setting = await SettingModel.getByKey('paystack_secret_key');
    if (setting && setting.value) {
      secretKey = setting.value;
    }
  } catch (err) {
    // Fallback
  }
  return secretKey;
}

class PaystackGateway extends BaseGateway {
  async initialize({ userId, email, amount, checkoutSessionId }) {
    try {
      const paystackSecretKey = await getPaystackSecretKey();
      const result = await paystackBreaker.execute({
        url: 'https://api.paystack.co/transaction/initialize',
        method: 'POST',
        body: {
          email,
          amount: Math.round(amount * 100), // convert to kobo
          metadata: { checkoutSessionId, userId }
        },
        customHeaders: {
          'Authorization': `Bearer ${paystackSecretKey}`,
          'Content-Type': 'application/json'
        }
      });

      const { data } = result;
      
      return {
        authorizationUrl: data.authorization_url,
        reference: data.reference
      };
    } catch (error) {
      console.error('Paystack Init Error:', error.message);
      throw error;
    }
  }

  async verify(reference) {
    try {
      const paystackSecretKey = await getPaystackSecretKey();
      const result = await paystackBreaker.execute({
        url: `https://api.paystack.co/transaction/verify/${reference}`,
        method: 'GET',
        customHeaders: {
          'Authorization': `Bearer ${paystackSecretKey}`
        }
      });

      return result.data;
    } catch (error) {
      throw error;
    }
  }

  async verifySignature(payload, signature) {
    try {
      const paystackSecretKey = await getPaystackSecretKey();
      const hash = crypto.createHmac('sha512', paystackSecretKey)
                         .update(JSON.stringify(payload))
                         .digest('hex');
      return hash === signature;
    } catch (error) {
      return false;
    }
  }

  async refund(reference, amount, reason) {
    try {
      const paystackSecretKey = await getPaystackSecretKey();
      const result = await paystackBreaker.execute({
        url: 'https://api.paystack.co/refund',
        method: 'POST',
        body: {
          transaction: reference,
          amount: Math.round(amount * 100),
          customer_note: reason || 'Refund for returned items'
        },
        customHeaders: {
          'Authorization': `Bearer ${paystackSecretKey}`,
          'Content-Type': 'application/json'
        }
      });
      return result.data;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = PaystackGateway;
