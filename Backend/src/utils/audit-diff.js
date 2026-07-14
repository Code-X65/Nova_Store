/**
 * audit-diff.js
 *
 * Produces a field-level diff ("delta") and a human-readable `summary`
 * from the before/after state of an audited resource. e.g.
 *   summary: "Price changed from $10 to $12; Status: draft → published"
 *
 * The delta powers the audit dashboard's expandable "what changed" column,
 * and the summary is reused by both the audit row and the notification body.
 */

const CURRENCY_FIELDS = new Set([
  'price', 'sale_price', 'cost_price', 'total_amount', 'subtotal',
  'shipping_cost', 'tax_amount', 'discount_amount', 'refund_amount'
]);

function areEqual(a, b) {
  if (a === b) return true;
  if (a === null || b === null || a === undefined || b === undefined) {
    return a === b;
  }
  if (typeof a !== typeof b) return false;
  if (typeof a === 'object') {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return a === b;
}

function formatValue(value, field) {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'object') return JSON.stringify(value);
  if (typeof value === 'number' && CURRENCY_FIELDS.has(field)) {
    try {
      return `$${Number(value).toFixed(2)}`;
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function humanize(field) {
  return field
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Compute a delta + summary between two state objects.
 *
 * @param {object} oldObj        - state before the change
 * @param {object} newObj        - state after the change
 * @param {object} [fieldLabels] - optional map of field → display label
 * @returns {{ delta: Array, summary: string }}
 */
function computeDelta(oldObj = {}, newObj = {}, fieldLabels = {}) {
  const delta = [];
  const oldMap = oldObj || {};
  const newMap = newObj || {};
  const keys = new Set([...Object.keys(oldMap), ...Object.keys(newMap)]);

  for (const key of keys) {
    const before = oldMap[key];
    const after = newMap[key];
    if (!areEqual(before, after)) {
      delta.push({
        field: key,
        label: fieldLabels[key] || humanize(key),
        before: before ?? null,
        after: after ?? null,
      });
    }
  }

  const summary = delta
    .map((d) => `${d.label} changed from ${formatValue(d.before, d.field)} to ${formatValue(d.after, d.field)}`)
    .join('; ');

  return { delta, summary };
}

/**
 * Build a summary string directly from pre-computed delta entries.
 */
function summarizeDelta(delta = []) {
  return delta
    .map((d) => `${d.label || humanize(d.field)} changed from ${formatValue(d.before, d.field)} to ${formatValue(d.after, d.field)}`)
    .join('; ');
}

module.exports = { computeDelta, summarizeDelta, formatValue, humanize };
