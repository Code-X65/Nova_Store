const supabase = require('../config/supabase');
const { supabaseAdmin } = supabase;
const eventBus = require('../realtime/event-bus');

/**
 * inventory-alert.service.js
 *
 * Evaluates `stock_alert_rules` against current `inventory_levels` and emits
 * a domain event (`inventory.stock_low`) when a level drops at/below its
 * threshold. Consumed by the notification router for in-app + email alerts.
 */
class InventoryAlertService {
  /**
   * Check a single product (and its variants) against applicable rules and
   * emit `inventory.stock_low` events for any breaches.
   * @returns {Promise<Array>} list of triggered alert payloads
   */
  async checkProductStock(productId) {
    const triggered = [];

    const { data: levels, error } = await supabaseAdmin
      .from('inventory_levels')
      .select('id, product_id, variant_id, warehouse_id, quantity, reserved, low_stock_threshold')
      .eq('product_id', productId);
    if (error) throw error;
    if (!levels || levels.length === 0) return triggered;

    const variantIds = levels.map((l) => l.variant_id).filter(Boolean);
    const warehouseIds = levels.map((l) => l.warehouse_id).filter(Boolean);

    const { data: rules, error: rErr } = await supabaseAdmin
      .from('stock_alert_rules')
      .select('*')
      .eq('is_active', true)
      .or(`scope.eq.global,scope.eq.product,and(scope.eq.variant,variant_id.in.(${variantIds.join(',')})),and(scope.eq.warehouse,warehouse_id.in.(${warehouseIds.join(',')}))`);
    if (rErr) throw rErr;
    const applicable = rules || [];

    for (const level of levels) {
      const threshold = level.low_stock_threshold ?? 10;
      const available = level.quantity - level.reserved;
      if (available > threshold) continue;

      const rule = applicable.find((r) => {
        if (r.scope === 'global') return true;
        if (r.scope === 'product') return r.product_id === level.product_id;
        if (r.scope === 'variant') return r.variant_id === level.variant_id;
        if (r.scope === 'warehouse') return r.warehouse_id === level.warehouse_id;
        return false;
      });
      if (!rule) continue;

      const payload = {
        productId: level.product_id,
        variantId: level.variant_id,
        warehouseId: level.warehouse_id,
        available,
        threshold,
        ruleId: rule.id,
        channels: rule.channels || ['in_app'],
        recipientRole: rule.recipient_role,
      };
      triggered.push(payload);
      eventBus.emit('inventory.stock_low', payload);
    }

    return triggered;
  }

  async createRule(rule) {
    const { data, error } = await supabaseAdmin
      .from('stock_alert_rules')
      .insert({
        scope: rule.scope || 'product',
        product_id: rule.productId || null,
        variant_id: rule.variantId || null,
        warehouse_id: rule.warehouseId || null,
        threshold: rule.threshold,
        channels: rule.channels || ['in_app', 'email'],
        recipient_role: rule.recipientRole || null,
        is_active: rule.isActive !== false,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async listRules({ productId, warehouseId } = {}) {
    let query = supabaseAdmin.from('stock_alert_rules').select('*').order('created_at', { ascending: true });
    if (productId) query = query.eq('product_id', productId);
    if (warehouseId) query = query.eq('warehouse_id', warehouseId);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  async updateRule(id, patch) {
    const { data, error } = await supabaseAdmin
      .from('stock_alert_rules')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    if (!data) {
      const e = new Error('Alert rule not found');
      e.statusCode = 404;
      throw e;
    }
    return data;
  }

  async deleteRule(id) {
    const { error } = await supabaseAdmin.from('stock_alert_rules').delete().eq('id', id);
    if (error) throw error;
    return true;
  }
}

module.exports = new InventoryAlertService();
