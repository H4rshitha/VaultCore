/**
 * Formats a numeric amount with standard currency formatting.
 *
 * @param {number|string} amount - The balance or transaction amount.
 * @param {string} currency - The 3-letter currency code (USD, EUR, INR, GBP, etc.).
 * @returns {string} Formatted currency string (e.g., "$12,450.00", "₹1,24,500.00").
 */
export function formatCurrency(amount, currency = 'USD') {
  const num = typeof amount === 'number' ? amount : parseFloat(amount) || 0;
  const safeCurrency = (currency || 'USD').toUpperCase();

  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: safeCurrency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  } catch {
    // Fallback for uncommon or non-ISO codes
    return `${safeCurrency} ${num.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
}

/**
 * Masks a 10-16 digit account number preserving only the last 4 digits.
 * Example: "100010001001" -> "•••• •••• 1001"
 *
 * @param {string} accountNumber - Raw account number string.
 * @returns {string} Masked account number.
 */
export function maskAccountNumber(accountNumber) {
  if (!accountNumber) return '•••• •••• ••••';
  const str = String(accountNumber).trim();
  if (str.length <= 4) return str;

  const last4 = str.slice(-4);
  const maskedLength = Math.max(4, str.length - 4);
  const dots = '•'.repeat(maskedLength);

  // Chunk in groups of 4 for clean banking visual layout
  const fullMasked = dots + last4;
  const chunks = fullMasked.match(/.{1,4}/g);
  return chunks ? chunks.join(' ') : `•••• ${last4}`;
}

/**
 * Calculates the total balance across an array of accounts.
 *
 * @param {Array} accounts - List of account objects with a `balance` field.
 * @returns {number} Total numerical balance.
 */
export function calculateTotalBalance(accounts = []) {
  if (!Array.isArray(accounts)) return 0;
  return accounts.reduce((acc, curr) => {
    const bal = typeof curr.balance === 'number' ? curr.balance : parseFloat(curr.balance) || 0;
    return acc + bal;
  }, 0);
}
