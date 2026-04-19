import { getCurrency, setCurrency, getPhpRate, DEFAULT_PHP_RATE } from './currency.js';
import { showToast, navigateTo } from './ui.js';
import { apiUploadImages } from './api.js';

// ── Theme ─────────────────────────────────────────────────
export function applyTheme(theme) {
  document.documentElement.classList.toggle('light-theme', theme === 'light');
  localStorage.setItem('tg_theme', theme);
  window.dispatchEvent(new CustomEvent('themeChange', { detail: theme }));
}

// ── Sync all settings UI to saved state ───────────────────
function syncUI() {
  const theme  = localStorage.getItem('tg_theme') || 'dark';
  const cur    = getCurrency();
  const rate   = getPhpRate();
  const phone  = localStorage.getItem('tg_contact_phone') || '';
  const email  = localStorage.getItem('tg_contact_email') || 'sales@tgpetrol.com';
  const logo   = localStorage.getItem('tg_logo_url') || '';

  // Theme buttons
  document.getElementById('themeDarkBtn')?.classList.toggle('active',  theme === 'dark');
  document.getElementById('themeLightBtn')?.classList.toggle('active', theme === 'light');

  // Currency buttons
  document.getElementById('setUsdBtn')?.classList.toggle('active', cur === 'USD');
  document.getElementById('setPhpBtn')?.classList.toggle('active', cur === 'PHP');

  // Rate
  const rateInput = document.getElementById('phpRateInput');
  if (rateInput) rateInput.value = rate;
  const rateDisplay = document.getElementById('currentRateDisplay');
  if (rateDisplay) rateDisplay.textContent =
    `₱${rate.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

  // Contact
  const phoneEl = document.getElementById('contactPhone');
  const emailEl = document.getElementById('contactEmail');
  if (phoneEl) phoneEl.value = phone;
  if (emailEl) emailEl.value = email;

  // Logo preview
  showLogoPreview(logo);
}

function showLogoPreview(url) {
  const wrap    = document.getElementById('logoPreviewWrap');
  const preview = document.getElementById('logoPreview');
  if (!wrap || !preview) return;
  if (url) {
    preview.src    = url;
    wrap.hidden    = false;
  } else {
    wrap.hidden    = true;
    preview.src    = '';
  }
}

// ── Logo upload ───────────────────────────────────────────
let logoFile = null;

function setupLogoZone() {
  const zone  = document.getElementById('logoZone');
  const input = document.getElementById('logoFile');
  const label = document.getElementById('logoZoneLabel');
  if (!zone || !input) return;

  // Drag-and-drop
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

  // Click-to-upload
  input.addEventListener('change', onLogoFileSelected);

  function onLogoFileSelected() {
    const file = input.files[0];
    if (!file) return;
    logoFile = file;
    if (label) label.textContent = `${file.name} — ready to upload`;

    // Show local preview instantly
    const reader = new FileReader();
    reader.onload = e => showLogoPreview(e.target.result);
    reader.readAsDataURL(file);
  }
}

async function uploadLogo() {
  if (!logoFile) {
    showToast('Please select a logo file first.', 'error');
    return;
  }

  const btn = document.getElementById('saveLogoBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Uploading…'; }

  const progressWrap = document.getElementById('logoProgress');
  const progressFill = document.getElementById('logoProgressFill');
  if (progressWrap) progressWrap.hidden = false;

  try {
    const result = await apiUploadImages(
      'store-logo',
      [logoFile],
      (pct) => { if (progressFill) progressFill.style.width = `${pct}%`; }
    );

    const url = result.urls?.[0];
    if (!url) throw new Error('No URL returned from upload.');

    localStorage.setItem('tg_logo_url', url);
    showLogoPreview(url);
    applyAdminLogo(url);

    // Notify storefront open in another tab
    window.dispatchEvent(new StorageEvent('storage', { key: 'tg_logo_url', newValue: url }));

    showToast('Logo uploaded and saved!', 'success');
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

// ── Apply logo in admin sidebar ───────────────────────────
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

  syncUI();
  setupLogoZone();

  // Apply existing logo to sidebar
  applyAdminLogo(localStorage.getItem('tg_logo_url') || '');

  // Also wire the new upload button (label is now "Upload Logo" not "Save Logo")
  document.getElementById('saveLogoBtn')?.addEventListener('click', uploadLogo);

  // Theme
  document.getElementById('themeDarkBtn')?.addEventListener('click', () => {
    applyTheme('dark'); syncUI(); showToast('Dark mode applied.', 'success');
  });
  document.getElementById('themeLightBtn')?.addEventListener('click', () => {
    applyTheme('light'); syncUI(); showToast('Light mode applied.', 'success');
  });

  // Currency
  document.getElementById('setUsdBtn')?.addEventListener('click', () => {
    setCurrency('USD'); syncUI();
  });
  document.getElementById('setPhpBtn')?.addEventListener('click', () => {
    setCurrency('PHP'); syncUI();
  });

  // Save exchange rate
  document.getElementById('saveCurrencyBtn')?.addEventListener('click', () => {
    const rate = parseFloat(document.getElementById('phpRateInput')?.value);
    if (isNaN(rate) || rate <= 0) { showToast('Enter a valid exchange rate.', 'error'); return; }
    if (rate > 9999) { showToast('Rate seems too high — please check.', 'error'); return; }
    localStorage.setItem('tg_php_rate', rate.toFixed(2));
    window.dispatchEvent(new CustomEvent('currencyChange', { detail: getCurrency() }));
    syncUI();
    showToast(`Rate saved: 1 USD = ₱${rate.toFixed(2)}`, 'success');
  });

  // Contact info
  document.getElementById('saveContactBtn')?.addEventListener('click', () => {
    const phone = document.getElementById('contactPhone')?.value.trim() || '';
    const email = document.getElementById('contactEmail')?.value.trim() || '';
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showToast('Please enter a valid email.', 'error'); return;
    }
    localStorage.setItem('tg_contact_phone', phone);
    localStorage.setItem('tg_contact_email', email || 'sales@tgpetrol.com');
    showToast('Contact info saved.', 'success');
  });

  // Remove logo
  document.getElementById('removeLogoBtn')?.addEventListener('click', () => {
    localStorage.removeItem('tg_logo_url');
    showLogoPreview('');
    applyAdminLogo('');
    logoFile = null;
    const label = document.getElementById('logoZoneLabel');
    if (label) label.textContent = '';
    showToast('Logo removed.', 'success');
  });
});
