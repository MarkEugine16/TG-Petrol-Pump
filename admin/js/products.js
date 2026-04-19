import { apiGetProducts, apiDeleteProduct, apiToggleFeatured } from './api.js';
import { escHtml, fmtPrice, catLabel, showToast } from './ui.js';

export let adminProducts = [];

// ── Load ──────────────────────────────────────────────────
export async function loadAllProducts() {
  try {
    const data    = await apiGetProducts({ limit: 100 });
    adminProducts = data.products || [];
    updateStats();
    renderDashTable();
    renderAllTable();
    const el = document.getElementById('allProductsCount');
    if (el) el.textContent = `${adminProducts.length} products total`;
  } catch (err) {
    console.error('loadAllProducts:', err);
    showToast('Failed to load products.', 'error');
  }
}

// ── Stats ─────────────────────────────────────────────────
function updateStats() {
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('sTotal', adminProducts.length);
  set('sIn',    adminProducts.filter(p => p.availability === 'in-stock').length);
  set('sOut',   adminProducts.filter(p => p.availability !== 'in-stock').length);
  set('sFeat',  adminProducts.filter(p => p.featured).length);
}

// ── Row builder (used by both tables) ────────────────────
// Both dashboard and all-products tables now show thumbnails.
// The only difference: dashboard shows "Views", all-products shows "Featured".
function buildRow(p, showFeatured = false) {
  const inStock = p.availability === 'in-stock';
  const label   = catLabel(p.category);
  const img     = p.images?.[0];
  const price   = p.finalPrice ?? p.price;

  // Desktop: standalone thumb column
  const thumbCell = `<td class="thumb-cell desktop-only">
    ${img
      ? `<img class="tbl-img" src="${escHtml(img)}"
             alt="${escHtml(p.name)}" loading="lazy"
             width="40" height="34"
             onerror="this.style.opacity='0.25'" />`
      : `<div class="tbl-img tbl-img-empty" aria-hidden="true"></div>`}
  </td>`;

  // Mobile: thumbnail embedded inside product name cell
  const mobileThumb = img
    ? `<img class="tbl-img-inline" src="${escHtml(img)}"
           alt="" loading="lazy"
           onerror="this.style.display='none'" />`
    : `<div class="tbl-img-inline tbl-img-empty" aria-hidden="true"></div>`;

  const extraCell = showFeatured
    ? `<td class="hide-mobile">${p.featured ? `<span class="pill pill-feat">★ Yes</span>` : `<span style="color:var(--muted);font-size:12px">—</span>`}</td>`
    : `<td class="hide-mobile">${p.views ?? 0}</td>`;

  return `<tr data-id="${escHtml(p.id)}">
    ${thumbCell}
    <td>
      <div class="tbl-product-cell">
        <span class="mobile-only">${mobileThumb}</span>
        <div class="tbl-name">${escHtml(p.name)}
          <small>${escHtml(p.id)}</small>
        </div>
      </div>
    </td>
    <td class="hide-mobile"><span style="color:var(--muted2);font-size:12px">${escHtml(label)}</span></td>
    <td><span class="tbl-price">${fmtPrice(price)}</span></td>
    <td class="hide-mobile">${p.stock ?? '—'}</td>
    <td><span class="pill ${inStock ? 'pill-in' : 'pill-out'}">${inStock ? 'In Stock' : 'Out of Stock'}</span></td>
    ${extraCell}
    <td>
      <div class="tbl-actions">
        <button class="btn btn-ghost btn-sm js-edit"
                data-id="${escHtml(p.id)}"
                aria-label="Edit ${escHtml(p.name)}">Edit</button>
        <button class="btn btn-danger btn-sm js-delete"
                data-id="${escHtml(p.id)}"
                data-name="${escHtml(p.name)}"
                aria-label="Delete ${escHtml(p.name)}">Delete</button>
        <button class="btn btn-ghost btn-sm js-feat"
                data-id="${escHtml(p.id)}"
                title="Toggle featured"
                aria-label="Toggle featured for ${escHtml(p.name)}">★</button>
      </div>
    </td>
  </tr>`;
}

// ── Dashboard table (recent 10, shows Views column) ───────
export function renderDashTable() {
  const tbody = document.getElementById('dashTableBody');
  if (!tbody) return;
  const rows = adminProducts.slice(0, 10);
  tbody.innerHTML = rows.length
    ? rows.map(p => buildRow(p, false)).join('')
    : `<tr><td colspan="8" class="table-empty">No products yet.</td></tr>`;
  attachHandlers(tbody);
}

// ── All products table (shows Featured column) ────────────
export function renderAllTable(list) {
  const tbody = document.getElementById('allTableBody');
  if (!tbody) return;
  const rows = list || adminProducts;
  tbody.innerHTML = rows.length
    ? rows.map(p => buildRow(p, true)).join('')
    : `<tr><td colspan="9" class="table-empty">No products found.</td></tr>`;
  attachHandlers(tbody);
}

// ── Row action handlers ───────────────────────────────────
function attachHandlers(tbody) {
  tbody.querySelectorAll('.js-edit').forEach(btn =>
    btn.addEventListener('click', () =>
      document.dispatchEvent(new CustomEvent('admin:editProduct', { detail: btn.dataset.id }))
    )
  );
  tbody.querySelectorAll('.js-delete').forEach(btn =>
    btn.addEventListener('click', () => openConfirm(btn.dataset.id, btn.dataset.name))
  );
  tbody.querySelectorAll('.js-feat').forEach(btn =>
    btn.addEventListener('click', async () => {
      try {
        await apiToggleFeatured(btn.dataset.id);
        showToast('Featured status updated.', 'success');
        await loadAllProducts();
      } catch (e) { showToast(e.message, 'error'); }
    })
  );
}

// ── Filter ────────────────────────────────────────────────
export function filterTable() {
  const q   = (document.getElementById('adminSearch')?.value || '').toLowerCase();
  const cat = document.getElementById('catFilter')?.value || '';
  renderAllTable(adminProducts.filter(p =>
    (!q   || p.name?.toLowerCase().includes(q)) &&
    (!cat || p.category === cat)
  ));
}

// ── Confirm delete dialog ─────────────────────────────────
let _deleteId = null;

function openConfirm(id, name) {
  _deleteId = id;
  const overlay = document.getElementById('confirmOverlay');
  const msg     = document.getElementById('confirmMsg');
  if (msg) msg.textContent = `Delete "${name}"? This cannot be undone.`;
  if (overlay) overlay.hidden = false;
}
function closeConfirm() {
  _deleteId = null;
  const overlay = document.getElementById('confirmOverlay');
  if (overlay) overlay.hidden = true;
}
async function doDelete() {
  if (!_deleteId) return;
  try {
    await apiDeleteProduct(_deleteId);
    showToast('Product deleted.', 'success');
    closeConfirm();
    await loadAllProducts();
  } catch (e) { showToast(e.message, 'error'); }
}

// ── Boot ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (!document.getElementById('dashTableBody')) return;

  loadAllProducts();

  document.getElementById('adminSearch')?.addEventListener('input', filterTable);
  document.getElementById('catFilter')?.addEventListener('change', filterTable);
  document.getElementById('confirmYes')?.addEventListener('click', doDelete);
  document.getElementById('confirmNo')?.addEventListener('click', closeConfirm);
  document.getElementById('confirmOverlay')?.addEventListener('click', e => {
    if (e.target === document.getElementById('confirmOverlay')) closeConfirm();
  });

  // Re-render tables when currency changes
  window.addEventListener('currencyChange', () => {
    renderDashTable();
    renderAllTable();
  });
});
