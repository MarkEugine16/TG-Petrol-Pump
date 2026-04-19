/**
 * public/js/currency.js
 * Currency conversion module for the storefront.
 *
 * All prices in Firestore are stored in USD.
 * The PHP rate is set by the owner in Admin → Settings → Currency.
 * It is stored in localStorage under 'tg_php_rate'.
 *
 * Conversion: PHP price = USD price × rate
 * Example: $150 × 60 = ₱9,000
 */

const CURRENCY_KEY = 'tg_currency';
const RATE_KEY     = 'tg_php_rate';
export const DEFAULT_PHP_RATE = 56.50;

// ── Active currency — kept in sync with localStorage ───────
let _current = localStorage.getItem(CURRENCY_KEY) || 'USD';

// ── Getters ────────────────────────────────────────────────
export function getCurrency() { return _current; }
export function isPhp()       { return _current === 'PHP'; }
export function getSymbol()   { return _current === 'PHP' ? '₱' : '$'; }

/**
 * Read the PHP rate live from localStorage every time it is called.
 * This ensures the storefront always uses the latest value the owner set.
 */
export function getPhpRate() {
  const saved = parseFloat(localStorage.getItem(RATE_KEY));
  return (saved && saved > 0) ? saved : DEFAULT_PHP_RATE;
}

/** Multiplier: 1 when USD, PHP rate when PHP */
export function getRate() {
  return _current === 'PHP' ? getPhpRate() : 1;
}

/**
 * Convert a USD price to the currently selected currency.
 * @param {number} usdPrice  — always pass the raw USD price from Firestore
 * @returns {number}
 */
export function convert(usdPrice) {
  const n = parseFloat(usdPrice) || 0;
  return n * getRate();
}

/**
 * Format a USD price as a display string in the current currency.
 * Example (USD active):  fmtCurrency(150)   → "$150.00"
 * Example (PHP, rate=60): fmtCurrency(150)  → "₱9,000.00"
 *
 * @param {number} usdPrice  — always pass the raw USD price from Firestore
 * @returns {string}
 */
export function fmtCurrency(usdPrice) {
  const converted = convert(usdPrice);
  return getSymbol() + converted.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Toggle between USD and PHP.
 * Saves to localStorage and dispatches a 'currencyChange' event on window.
 */
export function toggleCurrency() {
  _current = (_current === 'USD') ? 'PHP' : 'USD';
  localStorage.setItem(CURRENCY_KEY, _current);
  window.dispatchEvent(new CustomEvent('currencyChange', { detail: { currency: _current, rate: getPhpRate() } }));
}

/**
 * Force-set the currency.
 * @param {'USD'|'PHP'} currency
 */
export function setCurrency(currency) {
  if (currency !== 'USD' && currency !== 'PHP') return;
  _current = currency;
  localStorage.setItem(CURRENCY_KEY, _current);
  window.dispatchEvent(new CustomEvent('currencyChange', { detail: { currency: _current, rate: getPhpRate() } }));
}
