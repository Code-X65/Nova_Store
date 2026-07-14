const OrderStateMachine = require('../../../src/services/order-state-machine.service');
const OrderModel = require('../../../src/models/order.model');
const OrderStatusHistoryModel = require('../../../src/models/order-status-history.model');
const supabase = require('../../../src/config/supabase');

jest.mock('../../../src/models/order.model');
jest.mock('../../../src/models/order-status-history.model');
jest.mock('../../../src/config/supabase', () => ({
  from: jest.fn(),
  rpc: jest.fn()
}));

describe('OrderStateMachine', () => {
  const mockOrder = { id: 'order-1', order_number: 'NS-1', status: 'pending' };

  beforeEach(() => {
    jest.clearAllMocks();
    OrderModel.findById.mockResolvedValue(mockOrder);
    OrderModel.updateStatus.mockResolvedValue({ ...mockOrder, status: 'processing' });
    OrderStatusHistoryModel.create.mockResolvedValue({});
  });

  it('lists allowed transitions via RPC', async () => {
    supabase.rpc.mockResolvedValue({ data: [{ to_status: 'processing' }], error: null });
    const allowed = await OrderStateMachine.listAllowed('pending');
    expect(supabase.rpc).toHaveBeenCalledWith('allowed_order_transitions', { p_status: 'pending' });
    expect(allowed).toEqual([{ to_status: 'processing' }]);
  });

  it('rejects an illegal transition', async () => {
    supabase.from.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null })
    });
    await expect(OrderStateMachine.transition('order-1', 'shipped', {}))
      .rejects.toThrow(/Invalid order transition/);
  });

  it('enforces requires_note', async () => {
    supabase.from.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: { from_status: 'pending', to_status: 'cancelled', requires_note: true, is_terminal: true },
        error: null
      })
    });
    await expect(OrderStateMachine.transition('order-1', 'cancelled', {}))
      .rejects.toThrow(/requires a note/);
  });

  it('performs a valid transition', async () => {
    supabase.from.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: { from_status: 'pending', to_status: 'processing', requires_note: false, is_terminal: false },
        error: null
      })
    });
    const result = await OrderStateMachine.transition('order-1', 'processing', { actorId: 'admin-1', note: 'go' });
    expect(OrderModel.updateStatus).toHaveBeenCalledWith('order-1', 'processing', null, 'go', 'admin-1');
    expect(OrderStatusHistoryModel.create).toHaveBeenCalled();
    expect(result.status).toBe('processing');
  });
});
