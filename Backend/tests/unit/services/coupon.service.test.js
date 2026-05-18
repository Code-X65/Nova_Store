const couponService = require('../../../src/services/coupon.service');
const CouponModel = require('../../../src/models/coupon.model');
const CartService = require('../../../src/services/cart.service');
const supabase = require('../../../src/config/supabase');

jest.mock('../../../src/models/coupon.model');
jest.mock('../../../src/services/cart.service');
jest.mock('../../../src/config/supabase', () => {
  const fromMock = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    not: jest.fn().mockReturnThis(),
    then: jest.fn(function(resolve) {
      resolve({ data: [], error: null });
    })
  };
  return {
    from: jest.fn(() => fromMock),
    rpc: jest.fn(),
  };
});

describe('CouponService', () => {
  const mockCoupon = {
    id: 'coupon-uuid-1',
    code: 'SAVE10',
    type: 'percentage',
    value: 10,
    min_order_amount: 50,
    max_discount: 100,
    starts_at: new Date(Date.now() - 10000).toISOString(),
    expires_at: new Date(Date.now() + 10000).toISOString(),
    usage_limit: 100,
    used_count: 5,
    per_customer_limit: 1,
    is_active: true
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validateAndApplyCoupon', () => {
    it('should validate and apply a percentage coupon successfully for user', async () => {
      CouponModel.findByCode.mockResolvedValue(mockCoupon);
      supabase.rpc.mockResolvedValue({ data: true, error: null });

      const result = await couponService.validateAndApplyCoupon(
        'user-123',
        'cart-123',
        'SAVE10',
        100
      );

      expect(result.coupon).toEqual(mockCoupon);
      expect(result.discount).toBe(10.00);
      expect(result.newTotal).toBe(90.00);
    });

    it('should throw error if coupon is not found', async () => {
      CouponModel.findByCode.mockResolvedValue(null);

      await expect(
        couponService.validateAndApplyCoupon('user-123', 'cart-123', 'NOTFOUND', 100)
      ).rejects.toThrow('Invalid coupon code');
    });

    it('should throw error if coupon has expired', async () => {
      const expiredCoupon = {
        ...mockCoupon,
        expires_at: new Date(Date.now() - 5000).toISOString()
      };
      CouponModel.findByCode.mockResolvedValue(expiredCoupon);

      await expect(
        couponService.validateAndApplyCoupon('user-123', 'cart-123', 'SAVE10', 100)
      ).rejects.toThrow('Coupon expired');
    });

    it('should throw error if coupon usage limit is reached', async () => {
      const fullCoupon = {
        ...mockCoupon,
        usage_limit: 5,
        used_count: 5
      };
      CouponModel.findByCode.mockResolvedValue(fullCoupon);

      await expect(
        couponService.validateAndApplyCoupon('user-123', 'cart-123', 'SAVE10', 100)
      ).rejects.toThrow('Coupon usage limit reached');
    });

    it('should validate per_customer_limit successfully for guest using orders table', async () => {
      CouponModel.findByCode.mockResolvedValue(mockCoupon);
      
      const fromMock = supabase.from();
      fromMock.then.mockImplementationOnce((resolve) => resolve({ data: [], error: null }));

      const result = await couponService.validateAndApplyCoupon(
        null, // Guest
        'cart-123',
        'SAVE10',
        100,
        'guest@example.com' // Guest email
      );

      expect(result.coupon).toEqual(mockCoupon);
      expect(result.discount).toBe(10.00);
      expect(result.newTotal).toBe(90.00);
      expect(supabase.from).toHaveBeenCalledWith('orders');
    });

    it('should throw error if guest has already exceeded the coupon per_customer_limit', async () => {
      CouponModel.findByCode.mockResolvedValue(mockCoupon);
      
      const fromMock = supabase.from();
      fromMock.then.mockImplementationOnce((resolve) => resolve({ data: [{ id: 'order-already-placed' }], error: null }));

      await expect(
        couponService.validateAndApplyCoupon(
          null, // Guest
          'cart-123',
          'SAVE10',
          100,
          'guest@example.com'
        )
      ).rejects.toThrow('You are not eligible for this coupon or usage limit reached');
    });
  });
});
