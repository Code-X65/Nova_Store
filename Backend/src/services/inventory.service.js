const ProductModel = require('../models/product.model');
const InventoryTransactionModel = require('../models/inventory-transaction.model');
const supabase = require('../config/supabase');

class InventoryService {
  async addStock(productId, quantity, userId, notes, variantId = null) {
    const transactionData = {
      type: 'restock',
      quantity_change: quantity,
      variant_id: variantId,
      performed_by: userId,
      notes: notes || 'Manual restock'
    };

    return await ProductModel.updateStock(productId, quantity, transactionData);
  }

  async reduceStock(productId, quantity, referenceId, type = 'sale', userId = null, notes = null, variantId = null) {
    const transactionData = {
      type: type,
      quantity_change: -Math.abs(quantity),
      variant_id: variantId,
      reference_id: referenceId,
      performed_by: userId,
      notes: notes || `Stock reduced due to ${type}`
    };

    return await ProductModel.updateStock(productId, -Math.abs(quantity), transactionData);
  }

  async bulkUpdateStock(updates, userId) {
    const results = [];
    for (const update of updates) {
      const { productId, quantity, notes, variantId } = update;
      const result = await this.addStock(productId, quantity, userId, notes, variantId);
      results.push(result);
    }
    return results;
  }

  async getLowStockItems() {
    return await ProductModel.getLowStockProducts();
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

  async getAlerts(productId = null) {
    let query = supabase.from('inventory_alerts').select('*');
    if (productId) query = query.eq('product_id', productId);
    else query = query.is('product_id', null);

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  async configureAlert(alertData) {
    const { productId, threshold, notifyEmails, enabled } = alertData;
    
    // Check if alert already exists
    let query = supabase.from('inventory_alerts').select('id');
    if (productId) query = query.eq('product_id', productId);
    else query = query.is('product_id', null);

    const { data: existing, error: fetchError } = await query;
    const existingAlert = existing && existing.length > 0 ? existing[0] : null;

    if (existingAlert) {
      // Update
      const { data, error } = await supabase
        .from('inventory_alerts')
        .update({ 
          threshold, 
          notify_emails: notifyEmails, 
          enabled, 
          updated_at: new Date().toISOString() 
        })
        .eq('id', existingAlert.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    } else {
      // Insert
      const { data, error } = await supabase
        .from('inventory_alerts')
        .insert([{ product_id: productId, threshold, notify_emails: notifyEmails, enabled }])
        .select()
        .single();
      if (error) throw error;
      return data;
    }
  }
}

module.exports = new InventoryService();
