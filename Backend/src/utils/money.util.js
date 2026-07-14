const Intl = require('intl');

const NGN_LOCALE = 'en-NG';
const NGN_CURRENCY = 'NGN';
const NGN_SYMBOL = '₦';

function formatNaira(amount, options = {}) {
  const {
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
    showSymbol = true,
    showZeroCents = false,
  } = options;

  const safeAmount = Number(amount);
  if (Number.isNaN(safeAmount)) return showSymbol ? `${NGN_SYMBOL}0.00` : '0.00';

  let formatted = new Intl.NumberFormat(NGN_LOCALE, {
    style: showSymbol ? 'currency' : 'decimal',
    currency: NGN_CURRENCY,
    minimumFractionDigits: showZeroCents ? 0 : minimumFractionDigits,
    maximumFractionDigits: showZeroCents ? 0 : maximumFractionDigits,
  }).format(safeAmount);

  if (!showSymbol) {
    formatted = new Intl.NumberFormat(NGN_LOCALE, {
      minimumFractionDigits,
      maximumFractionDigits,
    }).format(safeAmount);
  }

  return formatted;
}

function formatKobo(kobo) {
  const safeKobo = Number(kobo);
  if (Number.isNaN(safeKobo)) return `${NGN_SYMBOL}0`;
  return `${NGN_SYMBOL}${(safeKobo / 100).toFixed(2)}`;
}

function parseNaira(str) {
  if (typeof str !== 'string') return Number(str) || 0;
  const cleaned = str.replace(/[^0-9.-]/g, '');
  const parsed = Number(cleaned);
  return Number.isNaN(parsed) ? 0 : parsed;
}

module.exports = {
  formatNaira,
  formatKobo,
  parseNaira,
  NGN_SYMBOL,
  NGN_CURRENCY,
};
