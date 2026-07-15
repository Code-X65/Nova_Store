const InventoryService = require('../../../src/services/inventory.service');
const ProductModel = require('../../../src/models/product.model');
const InventoryTransactionModel = require('../../../src/models/inventory-transaction.model');

jest.mock('../../../src/models/product.model');
jest.mock('../../../src/models/inventory-transaction.model');

describe('InventoryService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('addStock', () => {
    it('should call ProductModel.updateStock with correct args', async () => {
      ProductModel.updateStock.mockResolvedValue({ id: 'p1', stock_quantity: 60 });

      const result = await InventoryService.addStock('p1', 10, 'u1', 'notes', 'v1');

      expect(ProductModel.updateStock).toHaveBeenCalledWith('p1', 10, expect.objectContaining({
        type: 'restock',
        quantity_change: 10,
        variant_id: 'v1',
        performed_by: 'u1',
        notes: 'notes',
        store_id: expect.any(String)
      }));
      expect(result).toEqual({ id: 'p1', stock_quantity: 60 });
    });

    it('should use default notes when none provided', async () => {
      ProductModel.updateStock.mockResolvedValue({ id: 'p1', stock_quantity: 60 });

      await InventoryService.addStock('p1', 10, 'u1');

      expect(ProductModel.updateStock).toHaveBeenCalledWith(
        'p1', 10,
        expect.objectContaining({ notes: 'Manual restock' })
      );
    });
  });

  describe('reduceStock', () => {
    it('should call ProductModel.updateStock with negative quantity', async () => {
      ProductModel.updateStock.mockResolvedValue({ id: 'p1', stock_quantity: 90 });

      const result = await InventoryService.reduceStock('p1', 10, 'ref1', 'sale', 'u1', 'notes', 'v1');

      expect(ProductModel.updateStock).toHaveBeenCalledWith('p1', -10, expect.objectContaining({
        type: 'sale',
        quantity_change: -10,
        variant_id: 'v1',
        reference_id: 'ref1',
        performed_by: 'u1',
        notes: 'notes',
        store_id: expect.any(String)
      }));
      expect(result).toEqual({ id: 'p1', stock_quantity: 90 });
    });

    it('should default type to adjustment and generate default notes', async () => {
      ProductModel.updateStock.mockResolvedValue({ id: 'p1', stock_quantity: 90 });

      await InventoryService.reduceStock('p1', 5);

      expect(ProductModel.updateStock).toHaveBeenCalledWith(
        'p1', -5,
        expect.objectContaining({ type: 'sale', notes: 'Stock reduced due to sale' })
      );
    });
  });

  describe('adjustStock', () => {
    it('should pass reasonCode as transaction type and include store_id', async () => {
      ProductModel.updateStock.mockResolvedValue({ id: 'p1', stock_quantity: 8 });

      await InventoryService.adjustStock('p1', -2, 'damaged', 'u1', 'notes', 'v1');

      expect(ProductModel.updateStock).toHaveBeenCalledWith('p1', -2, expect.objectContaining({
        type: 'damaged',
        quantity_change: -2,
        variant_id: 'v1',
        performed_by: 'u1',
        notes: 'notes',
        reason_code: 'damaged',
        store_id: expect.any(String)
      }));
    });
  });

  describe('bulkUpdateStock', () => {
    it('should update multiple products sequentially', async () => {
      ProductModel.updateStock
        .mockResolvedValueOnce({ id: 'p1', stock_quantity: 60 })
        .mockResolvedValueOnce({ id: 'p2', stock_quantity: 40 });

      const updates = [
        { productId: 'p1', quantity: 10, notes: 'a', variantId: 'v1' },
        { productId: 'p2', quantity: 5, notes: 'b', variantId: null }
      ];

      const results = await InventoryService.bulkUpdateStock(updates, 'u1');

      expect(ProductModel.updateStock).toHaveBeenCalledTimes(2);
      expect(results.successCount).toBe(2);
      expect(results.failureCount).toBe(0);
      expect(results.succeeded).toEqual([
        { productId: 'p1', variantId: 'v1', result: { id: 'p1', stock_quantity: 60 } },
        { productId: 'p2', variantId: null, result: { id: 'p2', stock_quantity: 40 } }
      ]);
    });

    it('should continue past an individual failure and report it, not abort the batch', async () => {
      ProductModel.updateStock
        .mockResolvedValueOnce({ id: 'p1', stock_quantity: 60 })
        .mockRejectedValueOnce(new Error('DB error'))
        .mockResolvedValueOnce({ id: 'p3', stock_quantity: 40 });

      const updates = [
        { productId: 'p1', quantity: 10 },
        { productId: 'p2', quantity: 5 },
        { productId: 'p3', quantity: 5 }
      ];

      const results = await InventoryService.bulkUpdateStock(updates, 'u1');

      expect(ProductModel.updateStock).toHaveBeenCalledTimes(3);
      expect(results.successCount).toBe(2);
      expect(results.failureCount).toBe(1);
      expect(results.failed).toEqual([{ productId: 'p2', variantId: undefined, error: 'DB error' }]);
    });
  });

  describe('getLowStockItems', () => {
    it('should delegate to ProductModel with store id', async () => {
      ProductModel.getLowStockProducts.mockResolvedValue([{ id: 'p1' }]);

      const result = await InventoryService.getLowStockItems();

      expect(ProductModel.getLowStockProducts).toHaveBeenCalledWith(expect.any(String));
      expect(result).toEqual([{ id: 'p1' }]);
    });
  });

  describe('getInventoryHistory', () => {
    it('should delegate to InventoryTransactionModel with filters', async () => {
      InventoryTransactionModel.findAll.mockResolvedValue({
        transactions: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 }
      });

      const result = await InventoryService.getInventoryHistory(
        { productId: 'p1' },
        { page: 1, limit: 20 }
      );

      expect(InventoryTransactionModel.findAll).toHaveBeenCalledWith(
        { productId: 'p1' },
        { page: 1, limit: 20 }
      );
      expect(result).toEqual({
        transactions: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 }
      });
    });
  });

  describe('getProductInventoryDetail', () => {
    it('should delegate to ProductModel', async () => {
      ProductModel.getStockByProductId.mockResolvedValue({ id: 'p1', stock_quantity: 10 });

      const result = await InventoryService.getProductInventoryDetail('p1');

      expect(ProductModel.getStockByProductId).toHaveBeenCalledWith('p1');
      expect(result).toEqual({ id: 'p1', stock_quantity: 10 });
    });
  });

  describe('updateThreshold', () => {
    it('should call ProductModel.update', async () => {
      ProductModel.update.mockResolvedValue({ id: 'p1', low_stock_threshold: 15 });

      const result = await InventoryService.updateThreshold('p1', 15);

      expect(ProductModel.update).toHaveBeenCalledWith('p1', { low_stock_threshold: 15 });
      expect(result).toEqual({ id: 'p1', low_stock_threshold: 15 });
    });
  });

});
