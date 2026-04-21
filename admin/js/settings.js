/**
 * admin/js/settings.js
 * Settings page — saves ALL settings to Firestore via PUT /api/settings
 * so they apply to every visitor on every device, not just this browser.
 */

import { getCurrency, setCurrency, getPhpRate } from './currency.js';
import { showToast, navigateTo } from './ui.js';
import { apiUploadImages } from './api.js';

// ── Save settings to Firestore ────────────────────────────
async function saveToServer(updates) {
  const token = localStorage.getItem('tg_admin_token');
  const res = await fetch('/api/settings', {
    method:      'PUT',
    headers:     {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    credentials: 'include',
    body:        JSON.stringify(updates),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to save settings.');
  }
  return res.json();
}

// ── Theme ─────────────────────────────────────────────────
export function applyTheme(theme) {
  document.documentElement.classList.toggle('light-theme', theme === 'light');
  localStorage.setItem('tg_theme', theme);
  window.dispatchEvent(new CustomEvent('themeChange', { detail: theme }));
}

// ── Sync UI to current saved state ───────────────────────
function syncUI() {
  const theme = localStorage.getItem('tg_theme') || 'dark';
  const cur   = getCurrency();
  const rate  = getPhpRate();

  document.getElementById('themeDarkBtn')?.classList.toggle('active',  theme === 'dark');
  document.getElementById('themeLightBtn')?.classList.toggle('active', theme === 'light');
  document.getElementById('setUsdBtn')?.classList.toggle('active', cur === 'USD');
  document.getElementById('setPhpBtn')?.classList.toggle('active', cur === 'PHP');

  const rateInput = document.getElementById('phpRateInput');
  if (rateInput) rateInput.value = rate;
  const rateDisplay = document.getElementById('currentRateDisplay');
  if (rateDisplay) rateDisplay.textContent =
    `₱${rate.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

  const phone = localStorage.getItem('tg_contact_phone') || '';
  const email = localStorage.getItem('tg_contact_email') || '';
  const logo  = localStorage.getItem('tg_logo_url') || '';

  const phoneEl = document.getElementById('contactPhone');
  const emailEl = document.getElementById('contactEmail');
  if (phoneEl) phoneEl.value = phone;
  if (emailEl) emailEl.value = email;

  showLogoPreview(logo);
}

// ── Load current settings from server on page open ───────
async function loadCurrentSettings() {
  try {
    const res  = await fetch('/api/settings');
    if (!res.ok) return;
    const data = await res.json();

    // Sync to localStorage so UI reads them
    if (data.theme)        localStorage.setItem('tg_theme',         data.theme);
    if (data.phpRate)      localStorage.setItem('tg_php_rate',      data.phpRate);
    if (data.currency)     localStorage.setItem('tg_currency',      data.currency);
    if (data.logoUrl)      localStorage.setItem('tg_logo_url',      data.logoUrl);
    if (data.contactPhone) localStorage.setItem('tg_contact_phone', data.contactPhone);
    if (data.contactEmail) localStorage.setItem('tg_contact_email', data.contactEmail);

    if (data.theme)    applyTheme(data.theme);
    if (data.currency) setCurrency(data.currency);
    if (data.logoUrl)  applyAdminLogo(data.logoUrl);

  } catch { /* fail silently */ }
  syncUI();
}

function showLogoPreview(url) {
  const wrap    = document.getElementById('logoPreviewWrap');
  const preview = document.getElementById('logoPreview');
  if (!wrap || !preview) return;
  if (url) { preview.src = url; wrap.hidden = false; }
  else     { wrap.hidden = true; preview.src = ''; }
}

// ── Logo upload ───────────────────────────────────────────
let logoFile = null;

function setupLogoZone() {
  const zone  = document.getElementById('logoZone');
  const input = document.getElementById('logoFile');
  const label = document.getElementById('logoZoneLabel');
  if (!zone || !input) return;

  ['dragenter','dragover'].forEach(e =>
    zone.addEventListener(e, ev => { ev.preventDefault(); zone.classList.add('dragover'); })
  );
  ['dragleave','dragend'].forEach(e =>
    zone.addEventListener(e, () => zone.classList.remove('dragover'))
  );
  zone.addEventListener('drop', e => {
    e.preventDefault(); zone.classList.remove('dragover');
    if (!e.dataTransfer?.files?.[0]) return;
    const dt = new DataTransfer();
    dt.items.add(e.dataTransfer.files[0]);
    input.files = dt.files;
    onLogoFileSelected();
  });
  input.addEventListener('change', onLogoFileSelected);

  function onLogoFileSelected() {
    const file = input.files[0];
    if (!file) return;
    logoFile = file;
    if (label) label.textContent = `${file.name} — ready to upload`;
    const reader = new FileReader();
    reader.onload = e => showLogoPreview(e.target.result);
    reader.readAsDataURL(file);
  }
}

async function uploadLogo() {
  if (!logoFile) { showToast('Please select a logo file first.', 'error'); return; }

  const btn          = document.getElementById('saveLogoBtn');
  const progressWrap = document.getElementById('logoProgress');
  const progressFill = document.getElementById('logoProgressFill');
  if (btn) { btn.disabled = true; btn.textContent = 'Uploading…'; }
  if (progressWrap) progressWrap.hidden = false;

  try {
    const result = await apiUploadImages(
      'store-logo', [logoFile],
      pct => { if (progressFill) progressFill.style.width = `${pct}%`; }
    );
    const url = result.urls?.[0];
    if (!url) throw new Error('No URL returned.');

    // Save to Firestore so ALL visitors see the new logo
    await saveToServer({ logoUrl: url });
    localStorage.setItem('tg_logo_url', url);
    showLogoPreview(url);
    applyAdminLogo(url);
    showToast('Logo uploaded and saved for all visitors!', 'success');

    logoFile = null;
    const label = document.getElementById('logoZoneLabel');
    if (label) label.textContent = '';
    const input = document.getElementById('logoFile');
    if (input) input.value = '';

  } catch (e) {
    showToast(`Logo upload failed: ${e.message}`, 'error');
  } finally {
    if (progressWrap) progressWrap.hidden = true;
    if (progressFill) progressFill.style.width = '0%';
    if (btn) { btn.disabled = false; btn.textContent = 'Upload Logo'; }
  }
}

function applyAdminLogo(url) {
  const brand = document.querySelector('.sidebar-brand');
  if (!brand) return;
  let img = brand.querySelector('.admin-logo-img');
  if (url) {
    if (!img) {
      img = document.createElement('img');
      img.className = 'admin-logo-img';
      img.style.cssText = 'width:26px;height:26px;object-fit:contain;border-radius:5px;flex-shrink:0';
      brand.insertBefore(img, brand.firstChild);
    }
    img.src = url;
  } else {
    img?.remove();
  }
}

// ── Boot ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (!document.getElementById('page-settings')) return;

  // Load latest settings from server first
  loadCurrentSettings();
  setupLogoZone();
  applyAdminLogo(localStorage.getItem('tg_logo_url') || '');

  document.getElementById('saveLogoBtn')?.addEventListener('click', uploadLogo);

  // Theme buttons — save to Firestore immediately
  document.getElementById('themeDarkBtn')?.addEventListener('click', async () => {
    applyTheme('dark');
    syncUI();
    try {
      await saveToServer({ theme: 'dark' });
      showToast('Dark mode applied to all visitors.', 'success');
    } catch (e) { showToast(e.message, 'error'); }
  });
  document.getElementById('themeLightBtn')?.addEventListener('click', async () => {
    applyTheme('light');
    syncUI();
    try {
      await saveToServer({ theme: 'light' });
      showToast('Light mode applied to all visitors.', 'success');
    } catch (e) { showToast(e.message, 'error'); }
  });

  // Currency buttons
  document.getElementById('setUsdBtn')?.addEventListener('click', () => {
    setCurrency('USD'); syncUI();
  });
  document.getElementById('setPhpBtn')?.addEventListener('click', () => {
    setCurrency('PHP'); syncUI();
  });

  // Save currency settings — save to Firestore
  document.getElementById('saveCurrencyBtn')?.addEventListener('click', async () => {
    const rate = parseFloat(document.getElementById('phpRateInput')?.value);
    if (isNaN(rate) || rate <= 0) { showToast('Enter a valid exchange rate.', 'error'); return; }
    const cur  = getCurrency();
    localStorage.setItem('tg_php_rate', rate.toFixed(2));
    window.dispatchEvent(new CustomEvent('currencyChange', { detail: cur }));
    syncUI();
    try {
      await saveToServer({ currency: cur, phpRate: rate });
      showToast(`Saved: 1 USD = ₱${rate.toFixed(2)} — applied to all visitors.`, 'success');
    } catch (e) { showToast(e.message, 'error'); }
  });

  // Contact info — save to Firestore
  document.getElementById('saveContactBtn')?.addEventListener('click', async () => {
    const phone = document.getElementById('contactPhone')?.value.trim() || '';
    const email = document.getElementById('contactEmail')?.value.trim() || '';
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showToast('Please enter a valid email.', 'error'); return;
    }
    localStorage.setItem('tg_contact_phone', phone);
    localStorage.setItem('tg_contact_email', email || 'sales@tgpetrol.com');
    try {
      await saveToServer({ contactPhone: phone, contactEmail: email || 'sales@tgpetrol.com' });
      showToast('Contact info saved for all visitors.', 'success');
    } catch (e) { showToast(e.message, 'error'); }
  });

  // Remove logo
  document.getElementById('removeLogoBtn')?.addEventListener('click', async () => {
    localStorage.removeItem('tg_logo_url');
    showLogoPreview('');
    applyAdminLogo('');
    logoFile = null;
    try {
      await saveToServer({ logoUrl: '' });
      showToast('Logo removed.', 'success');
    } catch (e) { showToast(e.message, 'error'); }
  });
});
