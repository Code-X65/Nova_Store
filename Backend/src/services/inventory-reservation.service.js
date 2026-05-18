const ProductModel = require('../models/product.model');
const supabase = require('../config/supabase');

/**
 * Hold (reserve) stock for a 15-minute checkout window.
 * Uses an advisory lock on the product row to prevent concurrent double-reservation.
 * Returns the updated product row.
 */
async function reserveStock(productId, quantity) {
  return await ProductModel.updateReservedStock(productId, quantity);
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
