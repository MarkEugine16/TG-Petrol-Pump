/**
 * public/js/ui.js — shared storefront helpers
 */
import { fmtCurrency } from './currency.js';

export function escHtml(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
export function fmtPrice(usd) { return fmtCurrency(usd); }
export function stripHtml(html) {
  const el = document.createElement('div'); el.innerHTML = html || '';
  return el.textContent || '';
}
export function catLabel(cat) {
  return { 'fuel-dispensers':'Fuel Dispenser', 'spare-parts':'Spare Part', 'accessories':'Accessory' }[cat] || cat;
}
export function showToast(msg, type = 'success', ms = 3500) {
  const c = document.getElementById('toastContainer');
  if (!c) return;
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.setAttribute('role', 'alert');
  t.innerHTML = `<span aria-hidden="true">${type === 'success' ? '✓' : '✕'}</span> ${escHtml(msg)}`;
  c.appendChild(t);
  setTimeout(() => {
    t.style.transition = 'opacity 0.3s'; t.style.opacity = '0';
    setTimeout(() => t.remove(), 320);
  }, ms);
}
