const ReturnsService = require('../../../src/services/returns.service');
const ReturnsModel = require('../../../src/models/returns.model');
const OrderModel = require('../../../src/models/order.model');
const InventoryService = require('../../../src/services/inventory.service');
const RefundService = require('../../../src/services/refund.service');
const AuditService = require('../../../src/services/audit.service');
const supabase = require('../../../src/config/supabase');

jest.mock('../../../src/models/returns.model');
jest.mock('../../../src/models/order.model');
jest.mock('../../../src/services/inventory.service');
jest.mock('../../../src/services/refund.service');
jest.mock('../../../src/services/audit.service');
jest.mock('../../../src/config/supabase', () => ({ from: jest.fn() }));

const order = {
  id: 'order-1',
  order_number: 'NS-1',
  status: 'delivered',
  items: [{ product_id: 'p1', quantity: 2, variant_id: 'v1' }]
};

function rma(status) {
  return { id: 'rma-1', order_id: 'order-1', status, refund_amount: 1000 };
}

beforeEach(() => {
  jest.clearAllMocks();
  OrderModel.findById.mockResolvedValue(order);
  AuditService.log.mockResolvedValue(undefined);
  // _isAllowed: allow any transition in tests
  supabase.from.mockReturnValue({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: { from_status: 'x', to_status: 'y' }, error: null })
  });
});

describe('ReturnsService', () => {
  it('refuses to open an RMA for a non-delivered order', async () => {
    OrderModel.findById.mockResolvedValue({ ...order, status: 'processing' });
    await expect(ReturnsService.createRma({ orderId: 'order-1' }))
      .rejects.toThrow(/delivered\/returned/);
  });

  it('opens an RMA for a delivered order', async () => {
    ReturnsModel.create.mockResolvedValue({ id: 'rma-1', status: 'requested' });
    const r = await ReturnsService.createRma({ orderId: 'order-1', createdBy: 'u1' });
    expect(r.status).toBe('requested');
    expect(ReturnsModel.create).toHaveBeenCalledWith(expect.objectContaining({ rma_number: expect.stringMatching(/^RMA-NS-1-/) }));
  });

  it('rejects an invalid transition', async () => {
    ReturnsModel.findById.mockResolvedValue(rma('requested'));
    supabase.from.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null })
    });
    await expect(ReturnsService.transition('rma-1', 'complete', {}))
      .rejects.toThrow(/Invalid RMA transition/);
  });

  it('restocks inventory on QC pass (sellable)', async () => {
    ReturnsModel.findById.mockResolvedValue(rma('collected'));
    ReturnsModel.update.mockResolvedValue({ ...rma('qc_received'), condition: 'sellable' });
    InventoryService.addStock.mockResolvedValue({});

    await ReturnsService.transition('rma-1', 'complete_qc', { qcOutcome: 'sellable', adminId: 'a1' });
    expect(InventoryService.addStock).toHaveBeenCalledWith('p1', 2, 'a1', expect.any(String), 'v1');
    expect(ReturnsModel.update).toHaveBeenCalledWith('rma-1', expect.objectContaining({ status: 'qc_received', condition: 'sellable' }));
  });

  it('creates a pending refund on process_refund', async () => {
    ReturnsModel.findById.mockResolvedValue(rma('qc_received'));
    ReturnsModel.update.mockResolvedValue(rma('refund_pending'));
    RefundService.createRefund.mockResolvedValue({ id: 'ref-1', status: 'pending' });

    await ReturnsService.transition('rma-1', 'process_refund', { refundAmount: 1000, adminId: 'a1' });
    expect(RefundService.createRefund).toHaveBeenCalledWith(expect.objectContaining({
      orderId: 'order-1', amount: 1000, method: 'original_payment', requestedBy: 'a1'
    }));
  });

  it('gates completion on a released refund', async () => {
    ReturnsModel.findById.mockResolvedValue({ ...rma('refund_pending'), refund_amount: 1000 });
    RefundService.listForOrder.mockResolvedValue([{ status: 'pending' }]);
    OrderModel.update.mockResolvedValue({});

    await expect(ReturnsService.transition('rma-1', 'complete', { adminId: 'a1' }))
      .rejects.toThrow(/refund has not been released/);
  });

  it('completes when the refund is released', async () => {
    ReturnsModel.findById.mockResolvedValue({ ...rma('refund_pending'), refund_amount: 1000 });
    RefundService.listForOrder.mockResolvedValue([{ status: 'completed' }]);
    ReturnsModel.update.mockResolvedValue(rma('completed'));
    OrderModel.update.mockResolvedValue({ status: 'returned' });

    const result = await ReturnsService.transition('rma-1', 'complete', { adminId: 'a1' });
    expect(result.status).toBe('completed');
    expect(OrderModel.update).toHaveBeenCalledWith('order-1', { status: 'returned' });
  });
});
