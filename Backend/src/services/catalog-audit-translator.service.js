const { humanizeAction, humanizeActionType, ACTION_LABELS } = require('../utils/audit-labels');

const FIELD_TEMPLATES = {
  price:             'the {label}',
  cost_price:        'the {label}',
  sale_price:        'the sale {label}',
  stock_quantity:    'the stock quantity',
  status:            'the status',
  name:              'the name',
  description:       'the description',
  short_description: 'the short description',
  primary_image_url: 'the primary image',
  thumbnail_url:     'the thumbnail',
  weight:            'the weight',
  is_featured:       'the featured flag',
  meta_title:        'the SEO title',
  meta_description:  'the SEO meta description',
};

function formatDeltaValue(value, field) {
  if (value === null || value === undefined) return 'empty';
  if (typeof value === 'boolean') return value ? 'enabled' : 'disabled';
  if (typeof value === 'number' && ['price','cost_price','sale_price','stock_quantity','weight'].includes(field)) {
    return value % 1 === 0 ? String(value) : `$${value.toFixed(2)}`;
  }
  if (Array.isArray(value)) return `${value.length} items`;
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function formatCleanViewSentence(entry) {
  const template = FIELD_TEMPLATES[entry.field] || `"${entry.label || entry.field}"`;
  const before = formatDeltaValue(entry.before, entry.field);
  const after  = formatDeltaValue(entry.after, entry.field);
  return `${template} from ${before} to ${after}`;
}

function translateLog(log) {
  const parts = [];
  const actionWord = ACTION_LABELS[log.action] || humanizeAction(log.action) || 'modified';

  if (log.actorFullName) {
    const rolePrefix = log.actorRole
      ? `${humanizeActionType(log.actionType)} by ${log.actorRole} ${log.actorFullName}`
      : log.actorFullName;
    parts.push(rolePrefix);
  }

  parts.push(`${actionWord.toLowerCase()} the record for`);
  if (log.resourceName) parts.push(`"${log.resourceName}"`);
  else if (log.resourceSku) parts.push(`SKU ${log.resourceSku}`);
  else if (log.resourceId) parts.push(`ID ${log.resourceId}`);
  else parts.push(`a ${log.resourceType || 'resource'}`);

  if (Array.isArray(log.delta) && log.delta.length > 0) {
    const deltaParts = log.delta.map(d => formatCleanViewSentence(d));
    if (deltaParts.length === 1) parts.push(` — ${deltaParts[0]}`);
    else parts.push(`:\n  - ${deltaParts.join('\n  - ')}`);
  }

  return parts.join(' ');
}

module.exports = {
  translateLog,
  formatCleanViewSentence,
  formatDeltaValue,
};
