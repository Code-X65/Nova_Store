const RefundService = require('../../../src/services/refund.service');
const RefundModel = require('../../../src/models/refund.model');
const OrderModel = require('../../../src/models/order.model');
const PaymentService = require('../../../src/services/payment.service');
const AuditService = require('../../../src/services/audit.service');

jest.mock('../../../src/models/refund.model');
jest.mock('../../../src/models/order.model');
jest.mock('../../../src/services/payment.service');
jest.mock('../../../src/services/audit.service');

describe('RefundService', () => {
  const order = { id: 'order-1', order_number: 'NS-1', status: 'delivered' };

  beforeEach(() => {
    jest.clearAllMocks();
    OrderModel.findById.mockResolvedValue(order);
    AuditService.log.mockResolvedValue(undefined);
  });

  it('creates a pending refund', async () => {
    RefundModel.create.mockResolvedValue({ id: 'r1', status: 'pending', amount: 1000 });
    const refund = await RefundService.createRefund({ orderId: 'order-1', amount: 1000, requestedBy: 'u1' });
    expect(refund.status).toBe('pending');
    expect(RefundModel.create).toHaveBeenCalledWith(expect.objectContaining({ amount: 1000, status: 'pending' }));
  });

  it('rejects non-positive amounts', async () => {
    await expect(RefundService.createRefund({ orderId: 'order-1', amount: 0 }))
      .rejects.toThrow(/greater than zero/);
  });

  it('approves and processes a refund via the gateway', async () => {
    const pending = { id: 'r1', order_id: 'order-1', amount: 1000, status: 'pending' };
    RefundModel.findById.mockResolvedValue(pending);
    RefundModel.update
      .mockResolvedValueOnce({ ...pending, status: 'processing' })
      .mockResolvedValueOnce({ ...pending, status: 'completed', processed_at: 'now', gateway_reference: 'ref-1' });
    PaymentService.refundPayment.mockResolvedValue({ reference: 'ref-1' });

    const result = await RefundService.approveAndProcess('r1', 'admin-1');
    expect(PaymentService.refundPayment).toHaveBeenCalledWith('order-1', 1000, expect.any(String));
    expect(result.status).toBe('completed');
    expect(result.gateway_reference).toBe('ref-1');
  });

  it('marks the refund failed when the gateway errors', async () => {
    const pending = { id: 'r1', order_id: 'order-1', amount: 1000, status: 'pending' };
    RefundModel.findById.mockResolvedValue(pending);
    RefundModel.update.mockResolvedValue({ ...pending, status: 'processing' });
    PaymentService.refundPayment.mockRejectedValue(new Error('gateway down'));

    await expect(RefundService.approveAndProcess('r1', 'admin-1')).rejects.toMatchObject({ statusCode: 502 });
    expect(RefundModel.update).toHaveBeenLastCalledWith('r1', expect.objectContaining({ status: 'failed' }));
  });
});
