const supabase = require('../config/supabase');
const SettingModel = require('../models/setting.model');
const CustomerEventModel = require('../models/customer-event.model');
const NotificationService = require('./notification.service');
const logger = require('../utils/logger');

class CartRecoveryService {
  async getSettings() {
    const [enabledSetting, delaySetting] = await Promise.all([
      SettingModel.getByKey('cart_recovery.enabled'),
      SettingModel.getByKey('cart_recovery.delay_hours')
    ]);
    return {
      enabled: enabledSetting ? enabledSetting.value === 'true' : true,
      delayHours: delaySetting ? parseInt(delaySetting.value, 10) : 24
    };
  }

  /**
   * Carts that: belong to a registered user, have at least one item,
   * haven't been touched in `thresholdHours`, and haven't already been
   * reminded (any stage — single-reminder MVP).
   */
  async findAbandonedCarts(thresholdHours) {
    const cutoff = new Date(Date.now() - thresholdHours * 60 * 60 * 1000).toISOString();

    const { data: carts, error } = await supabase
      .from('carts')
      .select('id, user_id, updated_at, items:cart_items(id, quantity, unit_price)')
      .not('user_id', 'is', null)
      .lt('updated_at', cutoff);

    if (error) throw error;

    let candidates = (carts || []).filter((c) => (c.items || []).length > 0);
    if (candidates.length === 0) return [];

    const { data: alreadyReminded, error: logErr } = await supabase
      .from('cart_recovery_log')
      .select('cart_id')
      .in('cart_id', candidates.map((c) => c.id));
    if (logErr) throw logErr;

    const remindedIds = new Set((alreadyReminded || []).map((r) => r.cart_id));
    candidates = candidates.filter((c) => !remindedIds.has(c.id));
    if (candidates.length === 0) return [];

    // The cart is only cleared on successful payment (payment.service.js),
    // never at order creation — so a customer who already checked out and is
    // just awaiting a slow payment method (pay-on-delivery, bank transfer)
    // still has a "stale" cart here. Sending them an "you left something in
    // your cart!" reminder in that state is confusing, since they already
    // completed checkout. Exclude anyone with an order still awaiting payment.
    const { data: pendingOrders, error: ordersErr } = await supabase
      .from('orders')
      .select('user_id')
      .in('user_id', candidates.map((c) => c.user_id))
      .eq('payment_status', 'unpaid')
      .not('status', 'in', '(cancelled,refunded)');
    if (ordersErr) throw ordersErr;

    const usersWithPendingOrder = new Set((pendingOrders || []).map((o) => o.user_id));
    return candidates.filter((c) => !usersWithPendingOrder.has(c.user_id));
  }

  async sendReminders() {
    const { enabled, delayHours } = await this.getSettings();
    if (!enabled) {
      logger.info('[CartRecovery] Feature disabled via settings — skipping run.');
      return { sent: 0 };
    }

    const abandoned = await this.findAbandonedCarts(delayHours);
    let sent = 0;

    for (const cart of abandoned) {
      try {
        const itemCount = cart.items.reduce((sum, i) => sum + i.quantity, 0);
        const cartTotal = cart.items.reduce((sum, i) => sum + i.quantity * Number(i.unit_price), 0);

        await NotificationService.sendToUser(cart.user_id, 'abandoned_cart', {
          itemCount,
          cartTotal: `₦${cartTotal.toFixed(2)}`
        });

        await supabase.from('cart_recovery_log').insert([{
          cart_id: cart.id,
          user_id: cart.user_id,
          reminder_stage: 1
        }]);

        await CustomerEventModel.create({
          customer_id: cart.user_id,
          event_type: 'checkout_abandon',
          product_id: null
        }).catch((e) => logger.warn('[CartRecovery] Failed to log customer_event:', e.message));

        sent += 1;
      } catch (err) {
        logger.error(`[CartRecovery] Failed to send reminder for cart ${cart.id}:`, err.message);
      }
    }

    logger.info(`[CartRecovery] Sent ${sent} reminder(s) out of ${abandoned.length} abandoned cart(s).`);
    return { sent, scanned: abandoned.length };
  }

  /**
   * Called from checkout completion — marks any pending recovery log rows
   * for this user as recovered. Never throws (best-effort bookkeeping).
   */
  async markRecovered(userId) {
    try {
      await supabase
        .from('cart_recovery_log')
        .update({ recovered: true, recovered_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('recovered', false);
    } catch (err) {
      logger.warn('[CartRecovery] markRecovered failed (non-fatal):', err.message);
    }
  }

  // ── Admin ────────────────────────────────────────────────────────────────
  async getAbandonedCartsAdmin(pagination = { page: 1, limit: 20 }) {
    const { page, limit } = pagination;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, count, error } = await supabase
      .from('cart_recovery_log')
      .select('*, user:users(id,first_name,last_name,email), cart:carts(id)', { count: 'exact' })
      .order('sent_at', { ascending: false })
      .range(from, to);

    if (error) throw error;
    return { data, count, page, limit };
  }

  async updateSettings({ enabled, delayHours }) {
    if (enabled !== undefined) {
      await supabase.from('settings').update({ value: String(enabled), updated_at: new Date().toISOString() }).eq('key', 'cart_recovery.enabled');
    }
    if (delayHours !== undefined) {
      await supabase.from('settings').update({ value: String(delayHours), updated_at: new Date().toISOString() }).eq('key', 'cart_recovery.delay_hours');
    }
    return await this.getSettings();
  }
}

module.exports = new CartRecoveryService();
