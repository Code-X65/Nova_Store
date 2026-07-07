const InventoryService = require('../services/inventory.service');
const AuditService = require('../services/audit.service');

class InventoryController {
  async addStock(req, res, next) {
    try {
      const { productId, variantId, quantity, notes } = req.body;
      const userId = req.user.id;

      if (!productId || !quantity) {
        return res.status(400).json({ success: false, message: 'Product ID and quantity are required' });
      }

      const result = await InventoryService.addStock(productId, quantity, userId, notes, variantId);
      AuditService.log(req, 'inventory.stock_added', 'product', productId, null, { quantity, notes, variantId });
      res.status(200).json({ success: true, data: result, message: 'Stock updated successfully' });
    } catch (error) {
      next(error);
    }
  }

  async reduceStock(req, res, next) {
    try {
      const { productId, variantId, quantity, referenceId, type, notes } = req.body;
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
        variantId
      );
      AuditService.log(req, 'inventory.stock_reduced', 'product', productId, null, { quantity, type: type || 'adjustment', referenceId, notes, variantId });
      res.status(200).json({ success: true, data: result, message: 'Stock reduced successfully' });
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
      AuditService.log(req, 'inventory.bulk_updated', 'inventory', null, null, { count: updates.length, productIds: updates.map(u => u.productId) });
      res.status(200).json({ success: true, data: results, message: 'Bulk stock update completed' });
    } catch (error) {
      next(error);
    }
  }

  async getAlerts(req, res, next) {
    try {
      const { productId } = req.query;
      const alerts = await InventoryService.getAlerts(productId);
      res.status(200).json({ success: true, data: alerts });
    } catch (error) {
      next(error);
    }
  }

  async configureAlerts(req, res, next) {
    try {
      const result = await InventoryService.configureAlert(req.body);
      res.status(200).json({ success: true, data: result, message: 'Alert configuration updated' });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new InventoryController();
