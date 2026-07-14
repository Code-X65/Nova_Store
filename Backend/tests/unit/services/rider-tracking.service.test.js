const RiderTrackingService = require('../../../src/services/rider-tracking.service');
const RiderTrackingModel = require('../../../src/models/rider-tracking.model');

jest.mock('../../../src/models/rider-tracking.model');

describe('RiderTrackingService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('records a location ping', async () => {
    RiderTrackingModel.createPing.mockResolvedValue({ id: 'p1' });
    await RiderTrackingService.recordPing({ riderId: 'r1', orderId: 'o1', lat: 6.5, lng: 3.3 });
    expect(RiderTrackingModel.createPing).toHaveBeenCalledWith(expect.objectContaining({
      rider_id: 'r1', order_id: 'o1', lat: 6.5, lng: 3.3
    }));
  });

  it('requires lat/lng', async () => {
    await expect(RiderTrackingService.recordPing({ riderId: 'r1' }))
      .rejects.toThrow(/lat and lng/);
  });

  it('records proof of delivery with geo pin', async () => {
    RiderTrackingModel.recordPod.mockResolvedValue({ id: 'd1', delivered_lat: 6.5 });
    const r = await RiderTrackingService.recordPod('d1', { podPhotoUrl: 'u', lat: 6.5, lng: 3.3 });
    expect(RiderTrackingModel.recordPod).toHaveBeenCalledWith('d1', expect.objectContaining({ delivered_lat: 6.5, delivered_lng: 3.3 }));
    expect(r.delivered_lat).toBe(6.5);
  });

  it('returns the latest location', async () => {
    RiderTrackingModel.latestPing.mockResolvedValue({ lat: 6.5 });
    const l = await RiderTrackingService.getLatest('r1');
    expect(l).toEqual({ lat: 6.5 });
  });
});
