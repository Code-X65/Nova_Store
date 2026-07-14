const DisputeService = require('../../../src/services/dispute.service');
const DisputeModel = require('../../../src/models/dispute.model');
const OrderModel = require('../../../src/models/order.model');
const AuditService = require('../../../src/services/audit.service');

jest.mock('../../../src/models/dispute.model');
jest.mock('../../../src/models/order.model');
jest.mock('../../../src/services/audit.service');

describe('DisputeService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    OrderModel.findById.mockResolvedValue({ id: 'order-1', order_number: 'NS-1' });
    AuditService.log.mockResolvedValue(undefined);
  });

  it('creates a dispute (SLA set by DB trigger)', async () => {
    DisputeModel.create.mockResolvedValue({ id: 'd1', status: 'open', priority: 'medium' });
    const d = await DisputeService.createDispute({ orderId: 'order-1', subject: 'Wrong item', openedBy: 'u1' });
    expect(DisputeModel.create).toHaveBeenCalledWith(expect.objectContaining({ order_id: 'order-1', subject: 'Wrong item' }));
    expect(d.status).toBe('open');
  });

  it('resolves a dispute with resolution notes', async () => {
    DisputeModel.update.mockResolvedValue({ id: 'd1', status: 'resolved' });
    const d = await DisputeService.resolve('d1', { resolution: 'refunded', resolutionNotes: 'Goodwill' }, {});
    expect(DisputeModel.update).toHaveBeenCalledWith('d1', expect.objectContaining({
      status: 'resolved', resolution: 'refunded', resolution_notes: 'Goodwill', resolved_at: expect.any(String)
    }));
    expect(d.status).toBe('resolved');
  });

  it('escalates a dispute', async () => {
    DisputeModel.update.mockResolvedValue({ id: 'd1', status: 'escalated' });
    const d = await DisputeService.escalate('d1');
    expect(d.status).toBe('escalated');
  });
});
