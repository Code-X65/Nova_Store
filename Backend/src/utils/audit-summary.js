/**
 * audit-summary.js
 *
 * Domain-aware, Plain-English summaries for audit events. Replaces the generic
 * field-diff summary ("QuantityChange changed from (none) to 20; ...") with a
 * human-readable sentence suitable for both the audit row and the in-app
 * notification body.
 *
 *   Inventory Staff Jane Doe added 20 units of iPhone 15 (SKU: IP15-BLK) due to
 *   a 'Return'. Note: Found in backroom. [Location: WH-A; Batch/Lot: L-22; Stock: 30 → 50]
 */

const REASON_LABELS = {
  return: 'Return',
  damaged: 'Damage',
  restock: 'Restock',
  correction: 'Correction',
  loss: 'Loss',
  other: 'Other',
};

/**
 * Build a Plain-English inventory adjustment summary.
 *
 * @param {object} s
 * @param {string} [s.actorName]
 * @param {string} [s.actorRole]            - e.g. 'INVENTORY_STAFF'
 * @param {number} s.quantityChange         - signed delta
 * @param {string} [s.productName]
 * @param {string} [s.sku]
 * @param {string} [s.reasonCode]
 * @param {string} [s.notes]
 * @param {string} [s.warehouseLocation]
 * @param {string} [s.batchLot]
 * @param {number} [s.previousQuantity]
 * @param {number} [s.newQuantity]
 * @returns {string}
 */
function summarizeInventoryAdjustment(s = {}) {
  const {
    actorName, actorRole, quantityChange = 0, productName, sku,
    reasonCode, notes, warehouseLocation, batchLot,
    previousQuantity, newQuantity,
  } = s;

  const dir = quantityChange > 0 ? 'added' : 'removed';
  const abs = Math.abs(quantityChange);
  const role = actorRole ? `${actorRole.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())} ` : '';
  const who = actorName ? `${role}${actorName}` : 'A staff member';

  let out = `${who} ${dir} ${abs} unit${abs === 1 ? '' : 's'} of ${productName || 'a product'}`;
  if (sku) out += ` (SKU: ${sku})`;
  if (reasonCode) out += ` due to a '${REASON_LABELS[reasonCode] || reasonCode}'`;
  out += '.';

  const ctx = [];
  if (warehouseLocation) ctx.push(`Location: ${warehouseLocation}`);
  if (batchLot) ctx.push(`Batch/Lot: ${batchLot}`);
  if (Number.isFinite(previousQuantity) && Number.isFinite(newQuantity)) {
    ctx.push(`Stock: ${previousQuantity} → ${newQuantity}`);
  }
  if (notes) out += ` Note: ${notes}.`;
  if (ctx.length) out += ` [${ctx.join('; ')}]`;
  return out;
}

module.exports = { summarizeInventoryAdjustment, REASON_LABELS };
