const supabase = require('../config/supabase');
const { supabaseAdmin } = supabase;
const { SINGLE_STORE_ID } = require('../config/store');
const InventoryAlertService = require('./inventory-alert.service');

/**
 * warehouse.service.js
 *
 * Multi-location inventory. Stock is now modelled in `inventory_levels`
 * (product/variant x warehouse) instead of the single `products.stock_quantity`
 * column. The DB trigger keeps `products.stock_quantity` aggregated.
 */
class WarehouseService {
  async listWarehouses() {
    const { data, error } = await supabaseAdmin
      .from('warehouses')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async createWarehouse({ code, name, location }) {
    if (!code || !name) {
      const e = new Error('code and name are required');
      e.statusCode = 400;
      throw e;
    }
    const { data, error } = await supabaseAdmin
      .from('warehouses')
      .insert({ code, name, location: location || null })
      .select()
      .single();
    if (error) {
      if (error.code === '23505') {
        const e = new Error('Warehouse code already exists');
        e.statusCode = 409;
        throw e;
      }
      throw error;
    }
    return data;
  }

  async updateWarehouse(id, patch) {
    const { data, error } = await supabaseAdmin
      .from('warehouses')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    if (!data) {
      const e = new Error('Warehouse not found');
      e.statusCode = 404;
      throw e;
    }
    return data;
  }

  async deleteWarehouse(id) {
    // Prevent deletion while stock remains
    const { data: remaining } = await supabaseAdmin
      .from('inventory_levels')
      .select('id')
      .eq('warehouse_id', id)
      .gt('quantity', 0)
      .limit(1);
    if (remaining && remaining.length > 0) {
      const e = new Error('Cannot delete warehouse with remaining stock');
      e.statusCode = 409;
      throw e;
    }
    const { error } = await supabaseAdmin.from('warehouses').delete().eq('id', id);
    if (error) throw error;
    return true;
  }

  /** Upsert stock for a product/variant at a warehouse. */
  async setLevel({ productId, variantId, warehouseId, quantity, lowStockThreshold }) {
    if (!warehouseId || (!productId && !variantId)) {
      const e = new Error('warehouseId and productId or variantId are required');
      e.statusCode = 400;
      throw e;
    }
    const { data, error } = await supabaseAdmin
      .from('inventory_levels')
      .upsert(
        {
          product_id: productId || null,
          variant_id: variantId || null,
          warehouse_id: warehouseId,
          quantity: quantity ?? 0,
          low_stock_threshold: lowStockThreshold ?? 10,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'product_id,variant_id,warehouse_id' }
      )
      .select()
      .single();
    if (error) throw error;
    if (productId) InventoryAlertService.checkProductStock(productId).catch(() => {});
    return data;
  }

  async getStockByLocation({ productId, variantId, warehouseId } = {}) {
    let query = supabaseAdmin
      .from('inventory_levels')
      .select('id, product_id, variant_id, warehouse_id, quantity, reserved, low_stock_threshold, warehouses(name, code), products(sku, name), product_variants(sku)');
    if (productId) query = query.eq('product_id', productId);
    if (variantId) query = query.eq('variant_id', variantId);
    if (warehouseId) query = query.eq('warehouse_id', warehouseId);
    const { data, error } = await query.order('warehouse_id', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  /**
   * Transfer stock between warehouses, writing two inventory_transactions.
   * Returns the updated source/target levels.
   */
  async transferStock({ productId, variantId, fromWarehouseId, toWarehouseId, quantity, userId, notes }) {
    if (!fromWarehouseId || !toWarehouseId || quantity <= 0) {
      const e = new Error('fromWarehouseId, toWarehouseId and a positive quantity are required');
      e.statusCode = 400;
      throw e;
    }
    if (fromWarehouseId === toWarehouseId) {
      const e = new Error('Source and destination warehouses must differ');
      e.statusCode = 400;
      throw e;
    }

    let srcQuery = supabaseAdmin
      .from('inventory_levels')
      .select('id, quantity, reserved')
      .eq('warehouse_id', fromWarehouseId);
    srcQuery = productId ? srcQuery.eq('product_id', productId) : srcQuery.is('product_id', null);
    srcQuery = variantId ? srcQuery.eq('variant_id', variantId) : srcQuery.is('variant_id', null);
    const { data: src, error: srcErr } = await srcQuery.single();
    if (srcErr || !src) {
      const e = new Error('No stock record at source warehouse');
      e.statusCode = 404;
      throw e;
    }
    const available = src.quantity - src.reserved;
    if (available < quantity) {
      const e = new Error(`Insufficient available stock at source (${available} available)`);
      e.statusCode = 409;
      throw e;
    }

    const newSrcQty = src.quantity - quantity;
    let dstQuery = supabaseAdmin
      .from('inventory_levels')
      .select('id, quantity')
      .eq('warehouse_id', toWarehouseId);
    dstQuery = productId ? dstQuery.eq('product_id', productId) : dstQuery.is('product_id', null);
    dstQuery = variantId ? dstQuery.eq('variant_id', variantId) : dstQuery.is('variant_id', null);
    const { data: dstBefore } = await dstQuery.maybeSingle();

    const updates = [
      supabaseAdmin.from('inventory_levels').update({ quantity: newSrcQty, updated_at: new Date().toISOString() })
        .eq('id', src.id),
      supabaseAdmin.from('inventory_levels').upsert(
        {
          product_id: productId || null,
          variant_id: variantId || null,
          warehouse_id: toWarehouseId,
          quantity: (dstBefore?.quantity || 0) + quantity,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'product_id,variant_id,warehouse_id' }
      ),
    ];
    await Promise.all(updates);

    const newDstQty = (dstBefore?.quantity || 0) + quantity;
    await supabaseAdmin.from('inventory_transactions').insert([
      {
        product_id: productId || null,
        variant_id: variantId || null,
        type: 'transfer_out',
        quantity_change: -quantity,
        previous_quantity: src.quantity,
        new_quantity: newSrcQty,
        reference_id: null,
        notes: notes || `Transfer to warehouse ${toWarehouseId}`,
        performed_by: userId || null,
        store_id: SINGLE_STORE_ID,
      },
      {
        product_id: productId || null,
        variant_id: variantId || null,
        type: 'transfer_in',
        quantity_change: quantity,
        previous_quantity: dstBefore?.quantity || 0,
        new_quantity: newDstQty,
        reference_id: null,
        notes: notes || `Transfer from warehouse ${fromWarehouseId}`,
        performed_by: userId || null,
        store_id: SINGLE_STORE_ID,
      },
    ]);

    return this.getStockByLocation({ productId, variantId });
  }
}

module.exports = new WarehouseService();
