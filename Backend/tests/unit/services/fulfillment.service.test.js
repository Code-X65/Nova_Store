const FulfillmentService = require('../../../src/services/fulfillment.service');
const FulfillmentModel = require('../../../src/models/fulfillment.model');
const supabase = require('../../../src/config/supabase');
const crypto = require('crypto');

jest.mock('../../../src/models/fulfillment.model');
jest.mock('../../../src/config/supabase', () => ({ from: jest.fn() }));

describe('FulfillmentService webhook ingestion', () => {
  const provider = { id: 'prov-1', code: 'local', adapter: 'local', webhook_secret: 'topsecret' };

  beforeEach(() => {
    jest.clearAllMocks();
    FulfillmentModel.findProviderByCode.mockResolvedValue(provider);
    FulfillmentModel.findProvider.mockResolvedValue(provider);
    FulfillmentModel.updateShipment.mockResolvedValue({ id: 's1', status: 'delivered' });
    supabase.from.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: { id: 's1', provider_id: 'prov-1', external_shipment_id: 'ext-1' }, error: null })
    });
  });

  function sign(payload, secret) {
    return 'sha256=' + crypto.createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex');
  }

  it('accepts a valid HMAC signature and applies the status', async () => {
    const payload = { status: 'delivered', shipment_id: 'ext-1' };
    const sig = sign(payload, 'topsecret');
    const result = await FulfillmentService.ingestWebhook('local', JSON.stringify(payload), sig, payload);
    expect(result.status).toBe('delivered');
    expect(FulfillmentModel.updateShipment).toHaveBeenCalledWith('s1', expect.objectContaining({ status: 'delivered' }), expect.anything());
  });

  it('rejects an invalid signature', async () => {
    const payload = { status: 'delivered', shipment_id: 'ext-1' };
    await expect(FulfillmentService.ingestWebhook('local', JSON.stringify(payload), 'sha256=deadbeef', payload))
      .rejects.toMatchObject({ statusCode: 401 });
  });
});
