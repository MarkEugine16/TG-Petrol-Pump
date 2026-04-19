import { fmtCurrency, getCurrency, toggleCurrency } from './currency.js';
import { applyTheme } from './settings.js';

// ── Formatting ─────────────────────────────────────────────
export function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function fmtPrice(usdPrice) { return fmtCurrency(usdPrice); }

export function catLabel(cat) {
  return { 'fuel-dispensers':'Fuel Dispenser', 'spare-parts':'Spare Part', 'accessories':'Accessory' }[cat] || cat || '—';
}

// ── Toast ───────────────────────────────────────────────────
export function showToast(message, type = 'success', duration = 3500) {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.setAttribute('role', 'alert');
  toast.innerHTML = `<span aria-hidden="true">${type === 'success' ? '✓' : '✕'}</span> ${escHtml(message)}`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.transition = 'opacity 0.28s ease';
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ── SPA Navigation ──────────────────────────────────────────
export function navigateTo(pageId) {
  document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.sidebar-link[data-page]').forEach(a => a.classList.remove('active'));
  document.getElementById(`page-${pageId}`)?.classList.add('active');
  document.querySelector(`.sidebar-link[data-page="${pageId}"]`)?.classList.add('active');
  // Scroll main content to top on page change
  document.getElementById('mainContent')?.scrollTo(0, 0);
  window.scrollTo(0, 0);
}

// ── Mobile Sidebar ──────────────────────────────────────────
function setupMobileSidebar() {
  const sidebar    = document.getElementById('adminSidebar');
  const overlay    = document.getElementById('sidebarOverlay');
  const toggleBtn  = document.getElementById('sidebarToggle');
  const closeBtn   = document.getElementById('sidebarClose');

  if (!sidebar || !overlay || !toggleBtn) return;

  function openSidebar() {
    sidebar.classList.add('open');
    overlay.classList.add('visible');
    toggleBtn.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  }

  function closeSidebar() {
    sidebar.classList.remove('open');
    overlay.classList.remove('visible');
    toggleBtn.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }

  toggleBtn.addEventListener('click', () => {
    sidebar.classList.contains('open') ? closeSidebar() : openSidebar();
  });

  closeBtn?.addEventListener('click', closeSidebar);
  overlay.addEventListener('click', closeSidebar);

  // Auto-close when any nav link is tapped on mobile
  sidebar.querySelectorAll('.sidebar-link').forEach(link => {
    link.addEventListener('click', () => {
      if (window.innerWidth <= 900) closeSidebar();
    });
  });

  // Re-close if window resizes to desktop
  window.addEventListener('resize', () => {
    if (window.innerWidth > 900) closeSidebar();
  });
}

// ── Currency Toggle (sidebar + topbar) ─────────────────────
function setupCurrencyToggle() {
  // Sidebar toggle
  const sidebarBtn = document.getElementById('adminCurrencyToggle');
  // Topbar toggle (mobile)
  const topbarBtn  = document.getElementById('adminCurrencyToggleTop');

  function updateBtns() {
    const cur  = getCurrency();
    const label = cur === 'USD' ? '$ USD → ₱ PHP' : '₱ PHP → $ USD';
    const short = cur === 'USD' ? '$ USD' : '₱ PHP';
    if (sidebarBtn) sidebarBtn.textContent = label;
    if (topbarBtn)  topbarBtn.textContent  = short;
  }

  updateBtns();

  sidebarBtn?.addEventListener('click', () => { toggleCurrency(); });
  topbarBtn?.addEventListener('click',  () => { toggleCurrency(); });

  window.addEventListener('currencyChange', () => {
    updateBtns();
    // Refresh product tables so prices update
    import('./products.js').then(m => {
      m.renderDashTable?.();
      m.renderAllTable?.();
    }).catch(() => {});
  });

  // Also update when rate changes from settings page
  window.addEventListener('storage', (e) => {
    if (e.key === 'tg_php_rate' || e.key === 'tg_currency') updateBtns();
  });
}

// ── Boot ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (!document.getElementById('adminSidebar')) return;

  // Apply saved theme
  applyTheme(localStorage.getItem('tg_theme') || 'dark');

  // Setup mobile sidebar FIRST — critical for mobile usability
  setupMobileSidebar();

  // Setup currency
  setupCurrencyToggle();

  // Wire sidebar nav links
  document.querySelectorAll('.sidebar-link[data-page]').forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.page));
  });

  // Wire data-nav buttons (not add-product — handled in form.js)
  document.querySelectorAll('[data-nav]').forEach(btn => {
    const target = btn.dataset.nav;
    if (target === 'add-product') return;
    btn.addEventListener('click', () => navigateTo(target));
  });
});
