/**
 * admin/js/settings.js
 *
 * LOGO:  apiUploadImages('store-logo', [file]) → /api/upload/image → Cloudinary
 *        then PUT /api/settings { logoUrl } → Firestore
 *
 * THEME / CURRENCY / CONTACT:  PUT /api/settings → Firestore
 *
 * All settings stored in Firestore so every visitor on every device
 * gets the same values automatically.
 */

import { getCurrency, setCurrency, getPhpRate } from './currency.js';
import { showToast }                            from './ui.js';
import { apiUploadImages }                      from './api.js';

const getToken = () => localStorage.getItem('tg_admin_token') || '';

// ─── Save any settings to Firestore ──────────────────────
async function saveToFirestore(updates) {
  const res = await fetch('/api/settings', {
    method:      'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getToken()}`,
    },
    credentials: 'include',
    body: JSON.stringify(updates),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Server error ${res.status}`);
  return json;
}

// ─── Theme ────────────────────────────────────────────────
export function applyTheme(theme) {
  document.documentElement.classList.toggle('light-theme', theme === 'light');
  localStorage.setItem('tg_theme', theme);
}

// ─── Logo preview helper ──────────────────────────────────
function showLogoPreview(url) {
  const wrap = document.getElementById('logoPreviewWrap');
  const img  = document.getElementById('logoPreview');
  if (!wrap || !img) return;
  if (url) { img.src = url; wrap.hidden = false; }
  else     { wrap.hidden = true; img.src = ''; }
}

// ─── Apply logo to admin sidebar ─────────────────────────
function applyAdminLogo(url) {
  const brand = document.querySelector('.sidebar-brand');
  if (!brand) return;
  let img = brand.querySelector('.admin-logo-img');
  if (url) {
    if (!img) {
      img = document.createElement('img');
      img.className  = 'admin-logo-img';
      img.style.cssText = 'width:26px;height:26px;object-fit:contain;border-radius:5px;flex-shrink:0;';
      brand.insertBefore(img, brand.firstChild);
    }
    img.src = url;
  } else {
    img?.remove();
  }
}

// ─── Sync all UI to current values ───────────────────────
function syncUI() {
  const theme = localStorage.getItem('tg_theme')         || 'dark';
  const cur   = getCurrency();
  const rate  = getPhpRate();
  const logo  = localStorage.getItem('tg_logo_url')      || '';
  const phone = localStorage.getItem('tg_contact_phone') || '';
  const email = localStorage.getItem('tg_contact_email') || '';

  document.getElementById('themeDarkBtn')?.classList.toggle('active',  theme === 'dark');
  document.getElementById('themeLightBtn')?.classList.toggle('active', theme === 'light');
  document.getElementById('setUsdBtn')?.classList.toggle('active', cur === 'USD');
  document.getElementById('setPhpBtn')?.classList.toggle('active', cur === 'PHP');

  const rateInput   = document.getElementById('phpRateInput');
  const rateDisplay = document.getElementById('currentRateDisplay');
  if (rateInput)   rateInput.value     = rate;
  if (rateDisplay) rateDisplay.textContent =
    `₱${Number(rate).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

  const phoneEl = document.getElementById('contactPhone');
  const emailEl = document.getElementById('contactEmail');
  if (phoneEl) phoneEl.value = phone;
  if (emailEl) emailEl.value = email;

  showLogoPreview(logo);
}

// ─── Load settings from server on page open ───────────────
async function loadSettings() {
  try {
    const res  = await fetch('/api/settings');
    if (!res.ok) return;
    const data = await res.json();

    if (data.theme)        { localStorage.setItem('tg_theme',         data.theme);        applyTheme(data.theme); }
    if (data.currency)     { localStorage.setItem('tg_currency',      data.currency);     setCurrency(data.currency); }
    if (data.phpRate)        localStorage.setItem('tg_php_rate',      String(data.phpRate));
    if (data.logoUrl)      { localStorage.setItem('tg_logo_url',      data.logoUrl);      applyAdminLogo(data.logoUrl); }
    if (data.contactPhone)   localStorage.setItem('tg_contact_phone', data.contactPhone);
    if (data.contactEmail)   localStorage.setItem('tg_contact_email', data.contactEmail);
  } catch { /* use cached localStorage if server unavailable */ }
  syncUI();
}

// ═══════════════════════════════════════════════════════════
// LOGO UPLOAD
// Uses the same /api/upload/image endpoint as product images.
// productId = 'store-logo' isolates it in Cloudinary.
// ═══════════════════════════════════════════════════════════
let logoFile = null;

function setupLogoZone() {
  const zone  = document.getElementById('logoZone');
  const input = document.getElementById('logoFile');
  const label = document.getElementById('logoZoneLabel');
  if (!zone || !input) return;

  // Drag-and-drop
  ['dragenter', 'dragover'].forEach(e =>
    zone.addEventListener(e, ev => { ev.preventDefault(); zone.classList.add('dragover'); })
  );
  ['dragleave', 'dragend'].forEach(e =>
    zone.addEventListener(e, () => zone.classList.remove('dragover'))
  );
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('dragover');
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    handleLogoFile(file, label);
  });

  // Click to select
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (file) handleLogoFile(file, label);
  });
}

function handleLogoFile(file, label) {
  logoFile = file;
  if (label) label.textContent = `${file.name} (${fmtBytes(file.size)}) — ready`;
  // Show instant local preview
  const reader = new FileReader();
  reader.onload = e => showLogoPreview(e.target.result);
  reader.readAsDataURL(file);
}

async function uploadLogo() {
  if (!logoFile) {
    showToast('Please select a logo image first.', 'error');
    return;
  }

  const btn   = document.getElementById('saveLogoBtn');
  const pwrap = document.getElementById('logoProgress');
  const pfill = document.getElementById('logoProgressFill');

  if (btn)   { btn.disabled = true; btn.textContent = 'Uploading…'; }
  if (pwrap) pwrap.hidden = false;
  if (pfill) pfill.style.width = '0%';

  try {
    // Step 1 — Upload file to Cloudinary via /api/upload/image
    // This is the exact same endpoint used for product images — proven to work.
    const result = await apiUploadImages(
      'store-logo',
      [logoFile],
      pct => { if (pfill) pfill.style.width = `${pct}%`; }
    );

    const logoUrl = result?.urls?.[0];
    if (!logoUrl) throw new Error('Upload succeeded but no URL was returned.');

    // Step 2 — Save Cloudinary URL to Firestore
    await saveToFirestore({ logoUrl });

    // Step 3 — Apply everywhere
    localStorage.setItem('tg_logo_url', logoUrl);
    showLogoPreview(logoUrl);
    applyAdminLogo(logoUrl);
    showToast('Logo saved! All visitors will see it now.', 'success');

    // Reset
    logoFile = null;
    const input = document.getElementById('logoFile');
    const label = document.getElementById('logoZoneLabel');
    if (input) input.value = '';
    if (label) label.textContent = '';

  } catch (err) {
    showToast(`Logo upload failed: ${err.message}`, 'error');
  } finally {
    if (pwrap) pwrap.hidden = true;
    if (pfill) pfill.style.width = '0%';
    if (btn)   { btn.disabled = false; btn.textContent = 'Upload Logo'; }
  }
}

// ─── Utility ──────────────────────────────────────────────
function fmtBytes(b) {
  if (b < 1024)    return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}

// ═══════════════════════════════════════════════════════════
// BOOT
// ═══════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  if (!document.getElementById('page-settings')) return;

  loadSettings();
  setupLogoZone();
  applyAdminLogo(localStorage.getItem('tg_logo_url') || '');

  // Upload Logo button
  document.getElementById('saveLogoBtn')
    ?.addEventListener('click', uploadLogo);

  // Theme
  document.getElementById('themeDarkBtn')
    ?.addEventListener('click', async () => {
      applyTheme('dark');
      syncUI();
      try {
        await saveToFirestore({ theme: 'dark' });
        showToast('Dark mode applied to all visitors.', 'success');
      } catch (e) { showToast(e.message, 'error'); }
    });

  document.getElementById('themeLightBtn')
    ?.addEventListener('click', async () => {
      applyTheme('light');
      syncUI();
      try {
        await saveToFirestore({ theme: 'light' });
        showToast('Light mode applied to all visitors.', 'success');
      } catch (e) { showToast(e.message, 'error'); }
    });

  // Currency buttons (just set locally — saved on "Save Currency" click)
  document.getElementById('setUsdBtn')
    ?.addEventListener('click', () => { setCurrency('USD'); syncUI(); });
  document.getElementById('setPhpBtn')
    ?.addEventListener('click', () => { setCurrency('PHP'); syncUI(); });

  // Save currency + rate
  document.getElementById('saveCurrencyBtn')
    ?.addEventListener('click', async () => {
      const rate = parseFloat(document.getElementById('phpRateInput')?.value);
      if (isNaN(rate) || rate <= 0) {
        showToast('Please enter a valid exchange rate.', 'error'); return;
      }
      const currency = getCurrency();
      localStorage.setItem('tg_php_rate', rate.toFixed(2));
      window.dispatchEvent(new CustomEvent('currencyChange', { detail: currency }));
      syncUI();
      try {
        await saveToFirestore({ currency, phpRate: rate });
        showToast(`Saved — 1 USD = ₱${rate.toFixed(2)}`, 'success');
      } catch (e) { showToast(e.message, 'error'); }
    });

  // Contact info
  document.getElementById('saveContactBtn')
    ?.addEventListener('click', async () => {
      const phone = document.getElementById('contactPhone')?.value.trim() || '';
      const email = document.getElementById('contactEmail')?.value.trim() || '';
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showToast('Please enter a valid email address.', 'error'); return;
      }
      const contactEmail = email || 'sales@tgpetrol.com';
      localStorage.setItem('tg_contact_phone', phone);
      localStorage.setItem('tg_contact_email', contactEmail);
      try {
        await saveToFirestore({ contactPhone: phone, contactEmail });
        showToast('Contact info saved.', 'success');
      } catch (e) { showToast(e.message, 'error'); }
    });

  // Remove logo
  document.getElementById('removeLogoBtn')
    ?.addEventListener('click', async () => {
      logoFile = null;
      localStorage.removeItem('tg_logo_url');
      showLogoPreview('');
      applyAdminLogo('');
      const label = document.getElementById('logoZoneLabel');
      if (label) label.textContent = '';
      try {
        await saveToFirestore({ logoUrl: '' });
        showToast('Logo removed.', 'success');
      } catch (e) { showToast(e.message, 'error'); }
    });
});
