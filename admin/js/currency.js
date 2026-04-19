
const CURRENCY_KEY = 'tg_currency';
const RATE_KEY     = 'tg_php_rate';
export const DEFAULT_PHP_RATE = 56.50;

let _current = localStorage.getItem(CURRENCY_KEY) || 'USD';

export function getCurrency() { return _current; }
export function isPhp()       { return _current === 'PHP'; }
export function getSymbol()   { return _current === 'PHP' ? '₱' : '$'; }

export function getPhpRate() {
  const saved = parseFloat(localStorage.getItem(RATE_KEY));
  return (saved && saved > 0) ? saved : DEFAULT_PHP_RATE;
}

export function getRate() {
  return _current === 'PHP' ? getPhpRate() : 1;
}

export function convert(usdPrice) {
  const n = parseFloat(usdPrice) || 0;
  return n * getRate();
}

export function fmtCurrency(usdPrice) {
  const converted = convert(usdPrice);
  return getSymbol() + converted.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function toggleCurrency() {
  _current = (_current === 'USD') ? 'PHP' : 'USD';
  localStorage.setItem(CURRENCY_KEY, _current);
  window.dispatchEvent(new CustomEvent('currencyChange', { detail: { currency: _current, rate: getPhpRate() } }));
}

export function setCurrency(currency) {
  if (currency !== 'USD' && currency !== 'PHP') return;
  _current = currency;
  localStorage.setItem(CURRENCY_KEY, _current);
  window.dispatchEvent(new CustomEvent('currencyChange', { detail: { currency: _current, rate: getPhpRate() } }));
}
