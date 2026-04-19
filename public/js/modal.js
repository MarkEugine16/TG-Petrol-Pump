/**
 * public/js/modal.js
 * Product detail modal — updated for new HTML class names.
 */

import { escHtml, catLabel, showToast } from './ui.js';
import { trackView } from './api.js';
import { fmtCurrency } from './currency.js';

let current = null;
let prevFocus = null;

const $ = id => document.getElementById(id);

export function initModal() {
  $('modalClose')?.addEventListener('click', closeModal);
  $('modalOverlay')?.addEventListener('click', e => { if (e.target === $('modalOverlay')) closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('modalOverlay')?.classList.contains('open')) closeModal(); });
  $('modalInquiryBtn')?.addEventListener('click', doInquiry);
  $('modalPhoneBtn')?.addEventListener('click', doCall);
  $('modalShareBtn')?.addEventListener('click', doShare);
  window.addEventListener('currencyChange', () => { if (current) renderPrices(current); });
}

export function openModal(product) {
  current   = product;
  prevFocus = document.activeElement;
  trackView(product.id);
  populate(product);
  $('modalOverlay').classList.add('open');
  $('modalOverlay').setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  setTimeout(() => $('modalClose')?.focus(), 40);
}

export function closeModal() {
  $('modalOverlay').classList.remove('open');
  $('modalOverlay').setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  const v = $('modalVideoEl'); if (v) { v.pause(); v.src = ''; }
  prevFocus?.focus();
  current = null;
}

function populate(p) {
  const images = Array.isArray(p.images) ? p.images : [];
  const videos = Array.isArray(p.videos) ? p.videos : [];
  const inStock = p.availability === 'in-stock';

  // Images
  const mainImg = $('modalMainImg');
  const noImg   = $('modalNoImg');
  if (images.length) {
    mainImg.src    = images[0]; mainImg.alt = p.name;
    mainImg.style.display = 'block';
    if (noImg) noImg.style.display = 'none';
  } else {
    mainImg.style.display = 'none';
    if (noImg) noImg.style.display = 'flex';
  }

  // Thumbnails
  $('modalThumbs').innerHTML = images.map((url, i) => `
    <div class="modal-thumb ${i === 0 ? 'active' : ''}"
         tabindex="0" role="listitem"
         aria-label="View image ${i+1}" data-url="${escHtml(url)}">
      <img src="${escHtml(url)}" alt="" loading="lazy" onerror="this.style.opacity='0.3'" />
    </div>`).join('');

  $('modalThumbs').querySelectorAll('.modal-thumb').forEach(t => {
    const go = () => switchThumb(t, t.dataset.url);
    t.addEventListener('click', go);
    t.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') go(); });
  });

  // Video
  const vidWrap = $('modalVideo');
  const vidEl   = $('modalVideoEl');
  if (videos.length && vidWrap && vidEl) {
    vidEl.src = videos[0];
    vidWrap.hidden = false;
  } else if (vidWrap) {
    vidWrap.hidden = true;
  }

  // Badges
  $('modalBadges').innerHTML = `
    ${p.featured           ? `<span class="badge b-feat">★ Featured</span>` : ''}
    ${(p.discountPercent>0)? `<span class="badge b-disc">-${p.discountPercent}%</span>` : ''}
    <span class="badge b-cat">${escHtml(catLabel(p.category))}</span>
    <span class="badge ${inStock ? 'b-in' : 'b-out'}">${inStock ? '● In Stock' : '○ Out of Stock'}</span>`;

  $('modalName').textContent = p.name || '—';
  renderPrices(p);

  $('modalStock').innerHTML = `
    <span class="stock-dot ${inStock ? 'in' : 'out'}" aria-hidden="true"></span>
    <span>${inStock ? `In Stock${p.stock ? ` — ${p.stock} units` : ''}` : 'Currently Out of Stock'}</span>`;

  $('modalDesc').innerHTML = p.description
    || '<em style="color:var(--muted)">No description available.</em>';

  const specs    = p.specifications || {};
  const specKeys = Object.keys(specs).filter(k => specs[k]);
  $('modalSpecs').innerHTML = specKeys.length ? `
    <div class="specs-title">Specifications</div>
    <div class="specs-grid">
      ${specKeys.map(k => `
        <div class="spec-item">
          <div class="spec-key">${escHtml(k)}</div>
          <div class="spec-val">${escHtml(specs[k])}</div>
        </div>`).join('')}
    </div>` : '';

  // Phone button visibility
  //const phone = localStorage.getItem('tg_contact_phone') || '09451769531';
  //const phone = localStorage.setItem('tg_contact_phone', '09451769531');
  const phone = localStorage.getItem('tg_contact_phone') || '09451769531';
  const phoneBtn = $('modalPhoneBtn');
  if (phoneBtn) { phoneBtn.style.display = phone ? '' : 'none'; phoneBtn.title = phone ? `Call: ${phone}` : ''; }
}

function renderPrices(p) {
  const usdFinal = p.finalPrice ?? p.price;
  const hasDis   = (p.discountPercent || 0) > 0;
  $('modalPriceRow').innerHTML = `
    <div class="modal-price">${fmtCurrency(usdFinal)}</div>
    ${hasDis ? `
      <div class="modal-orig">${fmtCurrency(p.price)}</div>
      <div class="modal-save">Save ${fmtCurrency(p.price - usdFinal)}</div>` : ''}`;
}

function switchThumb(el, url) {
  document.querySelectorAll('.modal-thumb').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  const img = $('modalMainImg');
  img.src = url; img.style.display = 'block';
  const noImg = $('modalNoImg'); if (noImg) noImg.style.display = 'none';
}

function doCall() {
  const phone = localStorage.getItem('tg_contact_phone') || '';
  if (!phone) { showToast('Contact number not set.', 'error'); return; }
  window.open(`tel:${phone.replace(/\s+/g, '')}`);
}

function doInquiry() {
  if (!current) return;
  const email = localStorage.getItem('tg_contact_email') || 'sales@tgpetrol.com';
  const sub   = encodeURIComponent(`Inquiry: ${current.name}`);
  const body  = encodeURIComponent(
    `Hi,\n\nI'm interested in: ${current.name}\nPrice: ${fmtCurrency(current.finalPrice ?? current.price)}\n\nPlease send more details.\n\nThank you.`
  );
  window.open(`mailto:${email}?subject=${sub}&body=${body}`);
}

function doShare() {
  if (!current) return;
  const url = `${location.origin}?product=${current.id}`;
  if (navigator.share) {
    navigator.share({ title: current.name, url }).catch(() => {});
  } else {
    navigator.clipboard.writeText(url)
      .then(() => showToast('Link copied!', 'success'))
      .catch(() => showToast('Could not copy link.', 'error'));
  }
}
