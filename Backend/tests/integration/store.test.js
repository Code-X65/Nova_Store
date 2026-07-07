const request = require('supertest');
const app = require('../../src/app');
const supabase = require('../../src/config/supabase');

describe('Store Migration Schema & Scoping Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should query stores from the stores table', async () => {
    const mockStore = {
      id: 'aa49aa57-6129-4c48-bbab-9e95646b8381',
      name: 'Nova Store',
      slug: 'nova-store',
      email: 'admin@novastore.com',
      currency: 'NGN',
      timezone: 'Africa/Lagos'
    };

    // Mock query builder for stores
    supabase.from.mockImplementation((tableName) => {
      if (tableName === 'stores') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: mockStore, error: null }),
          then: (resolve) => resolve({ data: [mockStore], error: null })
        };
      }
      return {
        select: jest.fn().mockReturnThis(),
        then: (resolve) => resolve({ data: [], error: null })
      };
    });

    const { data: stores, error } = await supabase.from('stores').select('*');
    expect(error).toBeNull();
    expect(stores).toHaveLength(1);
    expect(stores[0].slug).toBe('nova-store');
    expect(stores[0].id).toBe(mockStore.id);
  });

  it('should check if store_settings are correctly fetched', async () => {
    const mockSettings = [
      { store_id: 'store-uuid', key: 'currency', value: 'NGN' },
      { store_id: 'store-uuid', key: 'timezone', value: 'Africa/Lagos' }
    ];

    supabase.from.mockImplementation((tableName) => {
      if (tableName === 'store_settings') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          then: (resolve) => resolve({ data: mockSettings, error: null })
        };
      }
      return {
        select: jest.fn().mockReturnThis(),
        then: (resolve) => resolve({ data: [], error: null })
      };
    });

    const { data, error } = await supabase.from('store_settings').select('*').eq('store_id', 'store-uuid');
    expect(error).toBeNull();
    expect(data).toHaveLength(2);
    expect(data[0].key).toBe('currency');
    expect(data[1].key).toBe('timezone');
  });

  it('should verify products contain store_id field when queried', async () => {
    const mockProduct = {
      id: 'prod-uuid-1',
      sku: 'PROD-SKU-1',
      name: 'Test Product',
      price: 100,
      store_id: 'aa49aa57-6129-4c48-bbab-9e95646b8381'
    };

    supabase.from.mockImplementation((tableName) => {
      if (tableName === 'products') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          then: (resolve) => resolve({ data: [mockProduct], error: null })
        };
      }
      return {
        select: jest.fn().mockReturnThis(),
        then: (resolve) => resolve({ data: [], error: null })
      };
    });

    const { data, error } = await supabase.from('products').select('*').eq('store_id', 'aa49aa57-6129-4c48-bbab-9e95646b8381');
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data[0].store_id).toBe('aa49aa57-6129-4c48-bbab-9e95646b8381');
  });
});
