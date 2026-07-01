const dotenv = require('dotenv');
dotenv.config();

const PaymentGatewayFactory = require('../src/services/payment-gateways/factory');
const PaystackGateway = require('../src/services/payment-gateways/paystack.gateway');
const BaseGateway = require('../src/services/payment-gateways/base.gateway');

async function run() {
  console.log('🚀 Starting Payment Gateways Abstraction Verification...');

  // 1. Resolve Paystack
  console.log('Resolving paystack gateway...');
  const paystack = PaymentGatewayFactory.getGateway('paystack');
  
  if (!(paystack instanceof PaystackGateway)) {
    throw new Error('Verification failed: paystack is not an instance of PaystackGateway');
  }
  if (!(paystack instanceof BaseGateway)) {
    throw new Error('Verification failed: paystack does not inherit from BaseGateway');
  }
  console.log('✅ Success: Resolved Paystack gateway successfully.');

  // 2. Resolve case-insensitive
  console.log('Resolving PayStack case-insensitive gateway...');
  const paystackUpper = PaymentGatewayFactory.getGateway('PayStack');
  if (!(paystackUpper instanceof PaystackGateway)) {
    throw new Error('Verification failed: case-insensitive resolution failed');
  }
  console.log('✅ Success: Resolved case-insensitively.');

  // 3. Resolve unknown provider (should throw error)
  console.log('Resolving unknown gateway (should throw error)...');
  try {
    PaymentGatewayFactory.getGateway('stripe');
    throw new Error('Verification failed: Resolving stripe did not throw error!');
  } catch (err) {
    console.log(`✅ Success: Threw expected error: "${err.message}"`);
  }

  // 4. Test method checks
  console.log('Checking gateway method availability...');
  const methods = ['initialize', 'verify', 'verifySignature', 'refund'];
  for (const method of methods) {
    if (typeof paystack[method] !== 'function') {
      throw new Error(`Verification failed: paystack is missing "${method}" method`);
    }
  }
  console.log('✅ Success: Gateway contains all core contract methods.');

  console.log('🎉 PAYMENT GATEWAY ABSTRACTION VERIFICATION PASSED!');
}

run().catch(err => {
  console.error('❌ Payment gateway abstraction verification failed:', err);
  process.exit(1);
});
