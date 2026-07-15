const InventoryService = require('../services/inventory.service');
const AuditService = require('../services/audit.service');
const ProductModel = require('../models/product.model');
const { summarizeInventoryAdjustment } = require('../utils/audit-summary');
const eventBus = require('../realtime/event-bus');
const { randomUUID } = require('crypto');

// ── Module-level helpers (no `this` — safe to call from class methods that
// are registered as bare Express handler references, where `this` is undefined). ──

function actorName(req) {
  return req.actor?.fullName || `${req.user?.firstName || ''} ${req.user?.lastName || ''}`.trim() || null;
}

// Build the canonical inventory.adjustment event + Plain-English audit summary.
function buildAdjustmentContext(req, result, product, { productId, variantId, quantityChange, reasonCode, notes, warehouseLocation, batchLot }) {
  const previousQuantity = result.previous_quantity;
  const newQuantity = result.stock_quantity;
  const summary = summarizeInventoryAdjustment({
    actorName: actorName(req),
    actorRole: req.user?.role,
    quantityChange,
    productName: product?.name,
    sku: product?.sku,
    reasonCode,
    notes,
    warehouseLocation,
    batchLot,
    previousQuantity,
    newQuantity,
  });

  const auditOpts = {
    actionType: 'UPDATE',
    severity: 'warning',
    summary,
    delta: [{ field: 'quantity', label: 'Quantity', before: previousQuantity, after: newQuantity }],
    resourceSku: product?.sku || null,
    resourceName: product?.name || null,
    resourceCategory: product?.category || null,
    contextLocation: warehouseLocation || null,
    contextBatchLot: batchLot || null,
    deltaNumeric: quantityChange,
    reasonCode: reasonCode || null,
    deviceInfo: { ip: req.ip, userAgent: req.get?.('user-agent'), sessionId: req.actor?.sessionId || req.sessionID || req.session?.id, requestId: req.id },
  };

  const eventPayload = {
    actor: req.actor || { id: req.user?.id, fullName: null, role: req.user?.role },
    resourceType: 'product',
    resourceId: productId,
    actionType: 'UPDATE',
    severity: 'info',
    title: 'Inventory adjustment',
    message: summary,
    data: {
      productId, sku: product?.sku, productName: product?.name,
      quantityChange, reasonCode, warehouseLocation, batchLot,
      previousQuantity, newQuantity, notes,
      deepLink: `/inventory/${productId}`,
    },
    deepLink: `/inventory/${productId}`,
  };

  return { summary, auditOpts, eventPayload };
}

class InventoryController {

  async addStock(req, res, next) {
    try {
      const { productId, variantId, quantity, notes, warehouseLocation, batchLot } = req.body;
      const userId = req.user.id;

      if (!productId || !quantity) {
        return res.status(400).json({ success: false, message: 'Product ID and quantity are required' });
      }

      const result = await InventoryService.addStock(productId, quantity, userId, notes, variantId, { warehouseLocation, batchLot });
      const product = await ProductModel.findById(productId);

      const { summary, auditOpts, eventPayload } = buildAdjustmentContext(req, result, product, {
        productId, variantId, quantityChange: quantity, reasonCode: 'restock', notes, warehouseLocation, batchLot,
      });

      const eventId = randomUUID();
      AuditService.log(req, 'inventory.stock_added', 'product', productId, null,
        { quantity, notes, variantId, warehouseLocation, batchLot }, { ...auditOpts, eventId });

      eventPayload.eventId = eventId;
      eventBus.emit('inventory.adjustment', eventPayload);

      res.status(200).json({ success: true, data: result, message: 'Stock updated successfully' });
    } catch (error) {
      next(error);
    }
  }

  async reduceStock(req, res, next) {
    try {
      const { productId, variantId, quantity, referenceId, type, notes, warehouseLocation, batchLot } = req.body;
      const userId = req.user.id;

      if (!productId || !quantity) {
        return res.status(400).json({ success: false, message: 'Product ID and quantity are required' });
      }

      const result = await InventoryService.reduceStock(
        productId,
        quantity,
        referenceId,
        type || 'adjustment',
        userId,
        notes,
        variantId,
        { warehouseLocation, batchLot }
      );
      const product = await ProductModel.findById(productId);

      const { summary, auditOpts, eventPayload } = buildAdjustmentContext(req, result, product, {
        productId, variantId, quantityChange: -Math.abs(quantity), reasonCode: type || 'adjustment', notes, warehouseLocation, batchLot,
      });

      const eventId = randomUUID();
      AuditService.log(req, 'inventory.stock_reduced', 'product', productId, null,
        { quantity, type: type || 'adjustment', referenceId, notes, variantId, warehouseLocation, batchLot }, { ...auditOpts, eventId });
      eventPayload.eventId = eventId;

      // Out-of-stock trigger (incl. during order picking).
      if (result && result.stock_quantity <= 0) {
        const eventKey = (type || 'adjustment') === 'sale' ? 'order.picked_out_of_stock' : 'inventory.out_of_stock';
        eventBus.emit(eventKey, {
          actor: req.actor || { id: userId, fullName: null, role: req.user?.role },
          resourceType: 'product',
          resourceId: productId,
          actionType: 'STATUS_CHANGE',
          severity: 'critical',
          title: eventKey === 'order.picked_out_of_stock' ? 'Out of stock while picking' : 'Out of stock',
          message: `Stock for product ${productId} hit zero${type === 'sale' ? ' during order picking' : ''}.`,
          data: { productId, variantId, type: type || 'adjustment' },
          deepLink: `/inventory/${productId}`,
        });
      }
      res.status(200).json({ success: true, data: result, message: 'Stock reduced successfully' });
    } catch (error) {
      next(error);
    }
  }

  async adjustStock(req, res, next) {
    try {
      const { productId, variantId, quantityChange, reasonCode, notes, warehouseLocation, batchLot } = req.body;
      const userId = req.user.id;

      if (!productId || quantityChange === undefined) {
        return res.status(400).json({ success: false, message: 'Product ID and quantityChange are required' });
      }

      if (quantityChange === 0) {
        return res.status(400).json({ success: false, message: 'quantityChange cannot be zero' });
      }

      const result = await InventoryService.adjustStock(
        productId,
        quantityChange,
        reasonCode,
        userId,
        notes,
        variantId,
        req.store?.id,
        { warehouseLocation, batchLot }
      );
      const product = await ProductModel.findById(productId);

      const { summary, auditOpts, eventPayload } = buildAdjustmentContext(req, result, product, {
        productId, variantId, quantityChange, reasonCode, notes, warehouseLocation, batchLot,
      });

      const eventId = randomUUID();
      AuditService.log(req, 'inventory.stock_adjusted', 'product', productId, null,
        { quantityChange, reasonCode, notes, variantId, warehouseLocation, batchLot }, { ...auditOpts, eventId });
      eventPayload.eventId = eventId;

      // Management notification: Store Manager + Store Owner.
      eventBus.emit('inventory.adjustment', eventPayload);

      // Manual stock discrepancy alert (security/accuracy-sensitive) → Warehouse Team.
      eventBus.emit('inventory.discrepancy', {
        actor: req.actor || { id: userId, fullName: null, role: req.user?.role },
        resourceType: 'product',
        resourceId: productId,
        actionType: 'UPDATE',
        severity: 'warning',
        title: 'Manual stock adjustment',
        message: summary,
        data: { productId, variantId, quantityChange, reasonCode, notes, warehouseLocation, batchLot },
        deepLink: `/inventory/${productId}`,
      });
      res.status(200).json({ success: true, data: result, message: 'Stock adjusted successfully' });
    } catch (error) {
      next(error);
    }
  }

  async getTransactions(req, res, next) {
    try {
       const { productId, type, page, limit } = req.query;
       const filters = { productId, type, store_id: req.store?.id };
       const pagination = { page: page || 1, limit: limit || 20 };

      const result = await InventoryService.getInventoryHistory(filters, pagination);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async getLowStock(req, res, next) {
    try {
       const products = await InventoryService.getLowStockItems(req.store?.id);
       res.status(200).json({ success: true, data: { products } });
    } catch (error) {
      next(error);
    }
  }

  async getProductInventory(req, res, next) {
    try {
      const { id } = req.params;
      const result = await InventoryService.getProductInventoryDetail(id);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async updateThreshold(req, res, next) {
    try {
      const { id } = req.params;
      const { lowStockThreshold } = req.body;

      if (lowStockThreshold === undefined) {
        return res.status(400).json({ success: false, message: 'lowStockThreshold is required' });
      }

      const result = await InventoryService.updateThreshold(id, lowStockThreshold);
      AuditService.log(req, 'inventory.threshold_updated', 'product', id, null, { lowStockThreshold });
      res.status(200).json({ success: true, data: result, message: 'Threshold updated successfully' });
    } catch (error) {
      next(error);
    }
  }

  async bulkUpdate(req, res, next) {
    try {
      const { updates } = req.body;
      const userId = req.user.id;

      if (!updates || !Array.isArray(updates)) {
        return res.status(400).json({ success: false, message: 'Updates array is required' });
      }

      const results = await InventoryService.bulkUpdateStock(updates, userId);
      AuditService.log(req, 'inventory.bulk_updated', 'inventory', null, null, {
        count: updates.length,
        successCount: results.successCount,
        failureCount: results.failureCount,
        productIds: updates.map(u => u.productId)
      });
      res.status(200).json({
        success: true,
        data: results,
        message: results.failureCount > 0
          ? `Bulk stock update completed with ${results.failureCount} failure(s) out of ${updates.length}`
          : 'Bulk stock update completed'
      });
    } catch (error) {
      next(error);
    }
  }

}

module.exports = new InventoryController();
