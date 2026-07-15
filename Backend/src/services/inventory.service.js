const ProductModel = require('../models/product.model');
const InventoryTransactionModel = require('../models/inventory-transaction.model');
const InventoryAlertService = require('./inventory-alert.service');
const { SINGLE_STORE_ID } = require('../config/store');

/** Fire a low-stock check without letting a failure block the stock operation that triggered it. */
function checkStockAlert(productId) {
  InventoryAlertService.checkProductStock(productId).catch((err) => {
    console.error(`[Inventory] Low-stock check failed for product ${productId}:`, err.message);
  });
}

class InventoryService {
  async addStock(productId, quantity, userId, notes, variantId = null, context = {}) {
    const { warehouseLocation, batchLot } = context;
    const transactionData = {
      type: 'restock',
      quantity_change: quantity,
      variant_id: variantId,
      performed_by: userId,
      notes: notes || 'Manual restock',
      warehouse_location: warehouseLocation || null,
      batch_lot: batchLot || null,
      store_id: SINGLE_STORE_ID
    };

    const result = await ProductModel.updateStock(productId, quantity, transactionData);
    checkStockAlert(productId);
    return result;
  }

  async reduceStock(productId, quantity, referenceId, type = 'sale', userId = null, notes = null, variantId = null, context = {}) {
    const { warehouseLocation, batchLot } = context;
    const transactionData = {
      type: type,
      quantity_change: -Math.abs(quantity),
      variant_id: variantId,
      reference_id: referenceId,
      performed_by: userId,
      notes: notes || `Stock reduced due to ${type}`,
      warehouse_location: warehouseLocation || null,
      batch_lot: batchLot || null,
      store_id: SINGLE_STORE_ID
    };

    const result = await ProductModel.updateStock(productId, -Math.abs(quantity), transactionData);
    checkStockAlert(productId);
    return result;
  }

  async adjustStock(productId, quantityChange, reasonCode, userId = null, notes = null, variantId = null, storeId = null, context = {}) {
    const { warehouseLocation, batchLot } = context;
    const transactionData = {
      type: reasonCode, // 'damaged', 'restock', 'correction', 'return', 'loss', 'other'
      quantity_change: quantityChange,
      variant_id: variantId,
      performed_by: userId,
      notes: notes || `Manual adjustment: ${reasonCode}`,
      reason_code: reasonCode,
      warehouse_location: warehouseLocation || null,
      batch_lot: batchLot || null,
      store_id: storeId || SINGLE_STORE_ID
    };

    const result = await ProductModel.updateStock(productId, quantityChange, transactionData);
    checkStockAlert(productId);
    return result;
  }

  async bulkUpdateStock(updates, userId) {
    const succeeded = [];
    const failed = [];
    for (const update of updates) {
      const { productId, quantity, notes, variantId } = update;
      try {
        const result = await this.addStock(productId, quantity, userId, notes, variantId);
        succeeded.push({ productId, variantId, result });
      } catch (err) {
        // Previously a single bad item aborted the whole batch — every item
        // already processed before it had already been written to the DB,
        // but the caller got a bare error with no report of what succeeded.
        failed.push({ productId, variantId, error: err.message });
      }
    }
    return { succeeded, failed, successCount: succeeded.length, failureCount: failed.length };
  }

  async getLowStockItems() {
    return await ProductModel.getLowStockProducts(SINGLE_STORE_ID);
  }

  async getInventoryHistory(filters, pagination) {
    return await InventoryTransactionModel.findAll(filters, pagination);
  }

  async getProductInventoryDetail(productId) {
    return await ProductModel.getStockByProductId(productId);
  }

  async updateThreshold(productId, threshold) {
    return await ProductModel.update(productId, { low_stock_threshold: threshold });
  }

}

module.exports = new InventoryService();
