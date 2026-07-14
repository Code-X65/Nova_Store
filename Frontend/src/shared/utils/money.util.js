const NGN_SYMBOL = '₦';

function formatNaira(amount, options = {}) {
  const {
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
    showSymbol = true,
  } = options;

  const safeAmount = Number(amount);
  if (Number.isNaN(safeAmount)) return showSymbol ? `${NGN_SYMBOL}0.00` : '0.00';

  const formatted = new Intl.NumberFormat('en-NG', {
    style: showSymbol ? 'currency' : 'decimal',
    currency: 'NGN',
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(safeAmount);

  return formatted;
}

function formatCompactNaira(amount) {
  const safeAmount = Number(amount);
  if (Number.isNaN(safeAmount)) return `${NGN_SYMBOL}0`;
  if (safeAmount >= 1000) {
    const k = Math.floor(safeAmount / 1000);
    const remainder = Math.floor(safeAmount % 1000);
    return `${NGN_SYMBOL}${k},${remainder.toString().padStart(3, '0')}`;
  }
  return `${NGN_SYMBOL}${safeAmount.toFixed(0)}`;
}

module.exports = {
  formatNaira,
  formatCompactNaira,
  NGN_SYMBOL,
};
