const ProductModel = require('../models/product.model');
const supabase = require('../config/supabase');

// Must match the checkout session TTL used in checkout.service.js's expiresAt.
const RESERVATION_TTL_MINUTES = 30;

/**
 * Hold (reserve) stock for the checkout window.
 * Uses an atomic DB-level guard (reserve_stock_increment) to prevent concurrent
 * double-reservation, then records the hold in `inventory_reservations` so the
 * expiry cron (release_expired_reservations) and session-abandonment path
 * (release_session_reservations) — both of which only scan that table — can
 * actually find and release it later. Without this row, the reservation would
 * never be released and would permanently shrink available stock.
 *
 * @param {string} checkoutSessionId - Required so the reservation can be tied
 *   back to (and released for) the checkout session that created it.
 * @returns The updated product row, or null if there wasn't enough stock to reserve.
 */
async function reserveStock(productId, quantity, variantId = null, checkoutSessionId = null) {
  const product = await ProductModel.updateReservedStock(productId, quantity, variantId);
  if (!product) {
    // Insufficient stock — the atomic guard rejected the reservation, nothing to track.
    return null;
  }

  if (checkoutSessionId) {
    const expiresAt = new Date(Date.now() + RESERVATION_TTL_MINUTES * 60 * 1000).toISOString();
    const { error } = await supabase.from('inventory_reservations').insert({
      product_id: productId,
      variant_id: variantId,
      quantity,
      checkout_session_id: checkoutSessionId,
      expires_at: expiresAt
    });
    if (error) {
      // Roll back the reservation we just took — we can't track it, so it would leak forever.
      await releaseReservation(productId, variantId, quantity);
      throw error;
    }
  }

  return product;
}

/**
 * Release (cancel) a previously-held reservation.
 */
async function releaseReservation(productId, variantId, quantity) {
  const { error } = await supabase.rpc('release_stock_reservation', {
    p_product_id:  productId,
    p_variant_id:  variantId,
    p_quantity:    quantity
  });
  if (error) throw error;
}

/**
 * Move up to `quantity` units from reserved → committed after successful payment.
 */
async function commitReservedStock(orderId) {
  const { error } = await supabase.rpc('commit_reserved_stock', { p_order_id: orderId });
  if (error) throw error;
}

/**
 * Bulk-release all reservations tied to a checkout session that have not been
 * superseded by a real order yet.
 */
async function releaseSessionReservations(sessionId) {
  const { error } = await supabase.rpc('release_session_reservations', { p_session_id: sessionId });
  if (error) throw error;
}

module.exports = { reserveStock, releaseReservation, commitReservedStock, releaseSessionReservations };
