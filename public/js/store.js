/**
 * public/js/store.js
 * Storefront entry point. Handles loading, filtering, rendering,
 * currency toggle, theme, and logo.
 */

import { fetchProducts, fetchProduct } from './api.js';
import { escHtml, stripHtml, catLabel, showToast } from './ui.js';
import { initModal, openModal } from './modal.js';
import { getCurrency, toggleCurrency, fmtCurrency, getPhpRate } from './currency.js';

// ── State ────────────────────────────────────────────────
let all      = [];
let filtered = [];
let category = 'all';
let search   = '';
let sortMode = 'newest';

// ── Boot ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  applyTheme(localStorage.getItem('tg_theme') || 'dark');
  applyLogo(localStorage.getItem('tg_logo_url') || '');
  initModal();
  wireCategoryButtons();
  wireSort();
  wireSearch();
  wireCurrencyBtn();
  await loadProducts();
  checkDeepLink();

  // Listen for changes from admin panel open in another tab
  window.addEventListener('storage', (e) => {
    if (e.key === 'tg_theme')    applyTheme(e.newValue || 'dark');
    if (e.key === 'tg_logo_url') applyLogo(e.newValue || '');
    if (e.key === 'tg_php_rate' || e.key === 'tg_currency') {
      updateCurrencyBtn();
      renderGrid(); // re-render with new rate/currency
    }
  });
});

// ── Theme ─────────────────────────────────────────────────
function applyTheme(t) {
  document.documentElement.classList.toggle('light-theme', t === 'light');
}

// ── Logo ──────────────────────────────────────────────────
function applyLogo(url) {
  const img      = document.getElementById('storeLogo');
  const initials = document.querySelector('.logo-initials');
  if (!img) return;
  if (url) {
    img.src    = url;
    img.hidden = false;
    if (initials) initials.style.display = 'none';
  } else {
    img.hidden = true;
    if (initials) initials.style.display = '';
  }
}

// ── Currency button ───────────────────────────────────────
function wireCurrencyBtn() {
  const btn = document.getElementById('currencyToggle');
  if (!btn) return;
  updateCurrencyBtn();
  btn.addEventListener('click', () => {
    toggleCurrency();
    updateCurrencyBtn();
    renderGrid();
  });
  window.addEventListener('currencyChange', () => {
    updateCurrencyBtn();
    renderGrid();
  });
}

function updateCurrencyBtn() {
  const btn  = document.getElementById('currencyToggle');
  const lbl  = document.getElementById('currencyLabel');
  const alt  = document.getElementById('currencyAlt');
  if (!btn) return;

  const cur  = getCurrency();
  const rate = getPhpRate();

  btn.classList.toggle('php-active', cur === 'PHP');

  if (cur === 'USD') {
    if (lbl) lbl.textContent = '$ USD';
    if (alt) alt.textContent = '₱ PHP';
    btn.title = `Click to switch to PHP (rate: ₱${rate.toFixed(2)} per $1)`;
    // Remove rate sub-label
    btn.querySelector('.currency-rate')?.remove();
  } else {
    if (lbl) lbl.textContent = '₱ PHP';
    if (alt) alt.textContent = '$ USD';
    btn.title = 'Click to switch back to USD';
    // Show rate sub-label
    let rateEl = btn.querySelector('.currency-rate');
    if (!rateEl) {
      rateEl = document.createElement('span');
      rateEl.className = 'currency-rate';
      btn.appendChild(rateEl);
    }
    rateEl.textContent = `₱${rate.toFixed(2)} / $1`;
  }
}

// ── Controls ──────────────────────────────────────────────
function wireCategoryButtons() {
  // Both desktop (.nav-cats) and mobile (.filter-bar) buttons
  document.querySelectorAll('.cat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const cat = btn.dataset.cat;
      category = cat;
      // Sync ALL cat buttons (both bars)
      document.querySelectorAll('.cat-btn').forEach(b => {
        const match = b.dataset.cat === cat;
        b.classList.toggle('active', match);
        b.setAttribute('aria-selected', match ? 'true' : 'false');
      });
      applyFilters();
    });
  });
}

function wireSort() {
  document.getElementById('sortSelect')?.addEventListener('change', (e) => {
    sortMode = e.target.value;
    applyFilters();
  });
}

function wireSearch() {
  let timer;
  document.getElementById('searchInput')?.addEventListener('input', (e) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      search = e.target.value.trim().toLowerCase();
      applyFilters();
    }, 280);
  });
}

// ── Load ──────────────────────────────────────────────────
async function loadProducts() {
  try {
    const data = await fetchProducts({ limit: 100 });
    all = data.products || [];
    const el = document.getElementById('statProducts');
    if (el) el.textContent = all.length;
    applyFilters();
  } catch (err) {
    const grid = document.getElementById('productsGrid');
    if (grid) grid.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        <h3>Could not load products</h3>
        <p>Please check your connection and refresh.</p>
      </div>`;
    showToast('Failed to load products.', 'error');
  }
}

// ── Filter & Sort ─────────────────────────────────────────
function applyFilters() {
  filtered = all.filter(p => {
    const matchCat = category === 'all' || p.category === category;
    const matchStr = !search ||
      p.name?.toLowerCase().includes(search) ||
      stripHtml(p.description || '').toLowerCase().includes(search);
    return matchCat && matchStr;
  });

  filtered.sort((a, b) => {
    switch (sortMode) {
      case 'price-asc':  return (a.finalPrice ?? a.price) - (b.finalPrice ?? b.price);
      case 'price-desc': return (b.finalPrice ?? b.price) - (a.finalPrice ?? a.price);
      case 'popular':    return (b.views ?? 0) - (a.views ?? 0);
      case 'featured':   return (b.featured ? 1 : 0) - (a.featured ? 1 : 0);
      default:           return (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0);
    }
  });

  const el = document.getElementById('resultsCount');
  if (el) el.textContent = `${filtered.length} product${filtered.length !== 1 ? 's' : ''}`;
  renderGrid();
}

// ── Render grid ───────────────────────────────────────────
function renderGrid() {
  const grid = document.getElementById('productsGrid');
  if (!grid) return;

  if (!filtered.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <h3>No products found</h3>
        <p>Try a different search or category.</p>
      </div>`;
    return;
  }

  grid.innerHTML = filtered.map((p, i) => buildCard(p, i)).join('');

  grid.querySelectorAll('.product-card').forEach(card => {
    const open = () => {
      const p = all.find(x => x.id === card.dataset.id);
      if (p) openModal(p);
    };
    card.addEventListener('click', open);
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
  });
}

// ── Build card ────────────────────────────────────────────
function buildCard(p, i) {
  const usdFinal = p.finalPrice ?? p.price;
  const hasDis   = (p.discountPercent || 0) > 0;
  const inStock  = p.availability === 'in-stock';
  const imgSrc   = p.images?.[0];
  const label    = catLabel(p.category);
  const delay    = (i % 12) * 40;

  const imgHtml = imgSrc
    ? `<img src="${escHtml(imgSrc)}" alt="${escHtml(p.name)}" loading="lazy"
           onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" />
       <div class="no-img" style="display:none">
         <svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2 1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
         <span>No Image</span>
       </div>`
    : `<div class="no-img">
         <svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2 1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
         <span>No Image</span>
       </div>`;

  return `
<article class="product-card" data-id="${escHtml(p.id)}"
  tabindex="0" role="button" aria-label="${escHtml(p.name)}"
  style="animation-delay:${delay}ms">
  <div class="card-img">
    ${imgHtml}
    <div class="card-badges">
      ${p.featured  ? `<span class="badge b-feat">★ Featured</span>` : ''}
      ${hasDis      ? `<span class="badge b-disc">-${p.discountPercent}%</span>` : ''}
      <span class="badge b-cat">${escHtml(label)}</span>
    </div>
    ${(p.images?.length ?? 0) > 1 ? `<span class="img-count">⊞ ${p.images.length}</span>` : ''}
    ${(p.videos?.length ?? 0) > 0 ? `<span class="vid-badge">▶ Video</span>` : ''}
  </div>
  <div class="card-body">
    <div class="card-name">${escHtml(p.name)}</div>
    <div class="card-desc">${escHtml(stripHtml(p.description) || 'No description available.')}</div>
    <div class="card-prices">
      <div class="card-price">${fmtCurrency(usdFinal)}</div>
      ${hasDis ? `<div class="card-orig">${fmtCurrency(p.price)}</div>` : ''}
      ${hasDis ? `<div class="card-save">Save ${fmtCurrency(p.price - usdFinal)}</div>` : ''}
    </div>
  </div>
  <div class="card-foot">
    <div class="stock-row">
      <span class="stock-dot ${inStock ? 'in' : 'out'}" aria-hidden="true"></span>
      <span style="color:${inStock ? 'var(--green)' : 'var(--red)'}; font-size:12px">
        ${inStock ? `In Stock${p.stock ? ` (${p.stock})` : ''}` : 'Out of Stock'}
      </span>
    </div>
    <span class="card-view-btn" aria-hidden="true">View Details</span>
  </div>
</article>`;
}

// ── Deep link ─────────────────────────────────────────────
async function checkDeepLink() {
  const id = new URLSearchParams(location.search).get('product');
  if (!id) return;
  try {
    const p = await fetchProduct(id);
    if (p?.id) openModal(p);
  } catch { /* ignore */ }
}
