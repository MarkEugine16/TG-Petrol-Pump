
import { apiCreateProduct, apiUpdateProduct, apiUploadImages, apiUploadVideo } from './api.js';
import { adminProducts, loadAllProducts } from './products.js';
import { showToast, navigateTo }          from './ui.js';
import { getPhpRate }                     from './currency.js';

const $ = id => document.getElementById(id);
const fieldVal = id => $(`f${id}`)?.value ?? '';
const specVal  = id => $(`spec${id}`)?.value.trim() ?? '';

// Files staged for upload on save
let selectedImageFiles = [];
let selectedVideoFile  = null;
// URLs already saved in Firestore (shown as existing previews when editing)
let existingImageUrls  = [];
let existingVideoUrls  = [];

// ── Price helpers ─────────────────────────────────────────
function getPriceInUsd() {
  const raw = parseFloat(fieldVal('Price')) || 0;
  const cur = $('fPriceCurrency')?.value || 'USD';
  if (cur === 'PHP') {
    const rate = getPhpRate();
    return rate > 0 ? raw / rate : raw;
  }
  return raw;
}

function updatePriceHint() {
  const hint = $('priceConvertHint');
  if (!hint) return;
  const raw  = parseFloat(fieldVal('Price'));
  const cur  = $('fPriceCurrency')?.value || 'USD';
  const rate = getPhpRate();
  if (!raw || raw <= 0 || !rate) { hint.textContent = ''; return; }
  if (cur === 'USD') {
    hint.textContent = `≈ ₱${(raw * rate).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} at ₱${rate.toFixed(2)} / $1`;
  } else {
    hint.textContent = `≈ $${(raw / rate).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} at ₱${rate.toFixed(2)} / $1`;
  }
}

// ── Reset form ────────────────────────────────────────────
export function resetForm() {
  $('editProductId').value       = '';
  $('formPageTitle').textContent = 'Add Product';
  $('saveBtnText').textContent   = 'Save Product';

  ['Name','Desc'].forEach(f => { const el = $(`f${f}`); if (el) el.value = ''; });
  ['FlowRate','Power','Weight','Dims'].forEach(f => { const el = $(`spec${f}`); if (el) el.value = ''; });

  $('fPrice').value      = '';
  $('fPriceCurrency') && ($('fPriceCurrency').value = 'USD');
  $('fDiscount').value   = '';
  $('fStock').value      = '';
  $('fCat').value        = '';
  $('fAvail').value      = 'in-stock';
  $('fFeatured').checked = false;

  clearFiles();
  existingImageUrls = [];
  existingVideoUrls = [];
  $('imgPreviews').innerHTML = '';
  $('formSuccess').hidden    = true;
  $('formError').hidden      = true;
  const hint = $('priceConvertHint'); if (hint) hint.textContent = '';
  hideProgress();
}

function clearFiles() {
  selectedImageFiles = [];
  selectedVideoFile  = null;
  const i = $('imgFiles'); if (i) i.value = '';
  const v = $('vidFile');  if (v) v.value = '';
  setZoneLabel('imgZoneLabel', '');
  setZoneLabel('vidZoneLabel', '');
}

// ── Populate form for editing ─────────────────────────────
export function populateForm(product) {
  $('editProductId').value       = product.id;
  $('formPageTitle').textContent = 'Edit Product';
  $('saveBtnText').textContent   = 'Update Product';

  $('fName').value       = product.name            || '';
  $('fCat').value        = product.category        || '';
  $('fAvail').value      = product.availability    || 'in-stock';
  $('fDiscount').value   = product.discountPercent || '';
  $('fStock').value      = product.stock           ?? '';
  $('fDesc').value       = product.description     || '';
  $('fFeatured').checked = product.featured        || false;
  $('fPriceCurrency') && ($('fPriceCurrency').value = 'USD');
  $('fPrice').value      = product.price           ?? '';
  updatePriceHint();

  const specs = product.specifications || {};
  $('specFlowRate').value = specs.flowRate   || '';
  $('specPower').value    = specs.power      || '';
  $('specWeight').value   = specs.weight     || '';
  $('specDims').value     = specs.dimensions || '';

  // Remember existing URLs so they are preserved when saving
  existingImageUrls = Array.isArray(product.images) ? [...product.images] : [];
  existingVideoUrls = Array.isArray(product.videos) ? [...product.videos] : [];

  // Show existing images as thumbnails (with individual remove buttons)
  renderExistingPreviews();

  clearFiles();
  $('formSuccess').hidden = true;
  $('formError').hidden   = true;
  hideProgress();
}

// Show existing Cloudinary images with a remove button each
function renderExistingPreviews() {
  const container = $('imgPreviews');
  if (!container) return;
  container.innerHTML = '';
  existingImageUrls.forEach(url => {
    const item = document.createElement('div');
    item.className = 'upload-preview-item';
    item.dataset.url = url;
    item.innerHTML = `
      <img src="${url}" alt="Existing image" loading="lazy"
           onerror="this.style.opacity='0.3'" />
      <button class="upload-preview-rm" type="button" aria-label="Remove image">✕</button>`;
    item.querySelector('.upload-preview-rm').addEventListener('click', () => {
      existingImageUrls = existingImageUrls.filter(u => u !== url);
      item.remove();
    });
    container.appendChild(item);
  });
}

// ── Validation ────────────────────────────────────────────
function validateForm() {
  const name  = fieldVal('Name').trim();
  const cat   = fieldVal('Cat');
  const price = parseFloat(fieldVal('Price'));

  if (!name)                    return 'Product name is required.';
  if (name.length > 200)        return 'Name must be ≤ 200 characters.';
  if (!cat)                     return 'Please select a category.';
  if (isNaN(price) || price <= 0) return 'A valid price greater than 0 is required.';

  const disc = parseFloat(fieldVal('Discount'));
  if (!isNaN(disc) && (disc < 0 || disc > 100))
    return 'Discount must be 0–100.';

  for (const f of selectedImageFiles) {
    if (f.size > 5 * 1024 * 1024) return `"${f.name}" exceeds the 5 MB limit.`;
  }
  if (selectedVideoFile && selectedVideoFile.size > 100 * 1024 * 1024)
    return `"${selectedVideoFile.name}" exceeds the 100 MB limit.`;

  return null;
}

// ── Build payload ─────────────────────────────────────────
// imageUrls / videoUrls are the NEWLY uploaded Cloudinary URLs.
// Combined with existingImageUrls so previously uploaded files are kept.
function buildPayload(newImageUrls = [], newVideoUrls = []) {
  const allImages = [...new Set([...existingImageUrls, ...newImageUrls])];
  const allVideos = [...new Set([...existingVideoUrls, ...newVideoUrls])];

  return {
    name:            fieldVal('Name').trim(),
    category:        fieldVal('Cat'),
    availability:    fieldVal('Avail'),
    price:           parseFloat(getPriceInUsd().toFixed(2)),
    discountPercent: parseFloat(fieldVal('Discount')) || 0,
    stock:           parseInt(fieldVal('Stock'))   || 0,
    description:     fieldVal('Desc'),
    featured:        $('fFeatured').checked,
    images:          allImages,
    videos:          allVideos,
    specifications: {
      flowRate:   specVal('FlowRate'),
      power:      specVal('Power'),
      weight:     specVal('Weight'),
      dimensions: specVal('Dims'),
    },
  };
}

// ══════════════════════════════════════════════════════════
// SAVE FLOW
// ══════════════════════════════════════════════════════════
async function saveProduct() {
  const btn       = $('saveProductBtn');
  const errEl     = $('formError');
  const successEl = $('formSuccess');
  errEl.hidden     = true;
  successEl.hidden = true;

  const err = validateForm();
  if (err) { showFormError(err); return; }

  btn.disabled   = true;
  const editId   = $('editProductId').value.trim();
  let productId  = editId;
  let newImgUrls = [];
  let newVidUrls = [];

  // Step 1 — Save text data
  setStatus('Saving product…');
  try {
    const payload = buildPayload([], []);
    if (editId) {
      await apiUpdateProduct(editId, payload);
    } else {
      const created = await apiCreateProduct(payload);
      productId = created.id;
      $('editProductId').value = productId;
    }
  } catch (e) {
    showFormError(e.message); btn.disabled = false; resetStatus(); return;
  }

  // Step 2 — Upload new images
  if (selectedImageFiles.length > 0) {
    const count = selectedImageFiles.length;
    setStatus(`Uploading ${count} image${count > 1 ? 's' : ''}…`);
    showProgress(); setProgressBar(10);
    try {
      const res = await apiUploadImages(productId, selectedImageFiles, setProgressBar);
      newImgUrls = res.urls || [];
      existingImageUrls = [...new Set([...existingImageUrls, ...newImgUrls])];
      showToast(`${newImgUrls.length} image${newImgUrls.length > 1 ? 's' : ''} uploaded.`, 'success');
      appendNewPreviews(newImgUrls);
    } catch (e) {
      showToast(`⚠ Image upload: ${e.message}`, 'error');
    }
    setProgressBar(100); setTimeout(hideProgress, 400);
  }

  // Step 3 — Upload video
  if (selectedVideoFile) {
    setStatus('Uploading video…');
    showProgress(); setProgressBar(10);
    try {
      const res = await apiUploadVideo(productId, selectedVideoFile, setProgressBar);
      if (res.url) {
        newVidUrls = [res.url];
        existingVideoUrls = [...new Set([...existingVideoUrls, ...newVidUrls])];
      }
      showToast('Video uploaded.', 'success');
    } catch (e) {
      showToast(`⚠ Video upload: ${e.message}`, 'error');
    }
    setProgressBar(100); setTimeout(hideProgress, 400);
  }

  // Step 4 — Save final URLs if any media was uploaded
  if (newImgUrls.length > 0 || newVidUrls.length > 0) {
    setStatus('Saving media…');
    try {
      await apiUpdateProduct(productId, buildPayload(newImgUrls, newVidUrls));
    } catch (e) {
      showToast(`⚠ Media save: ${e.message}`, 'error');
    }
  }

  clearFiles();
  successEl.hidden = false;
  showToast('Product saved!', 'success');
  await loadAllProducts();
  resetStatus(); btn.disabled = false;
  setTimeout(() => navigateTo('products'), 1800);
}

// ── File selection handlers ───────────────────────────────
function onImagesSelected() {
  const files = Array.from($('imgFiles').files);
  if (!files.length) return;
  selectedImageFiles = files;

  // Remove pending previews and re-add
  $('imgPreviews').querySelectorAll('.preview-pending').forEach(el => el.remove());
  files.forEach(file => {
    const url  = URL.createObjectURL(file);
    const item = document.createElement('div');
    item.className = 'upload-preview-item preview-pending';
    item.innerHTML = `
      <img src="${url}" alt="${file.name}" title="${file.name}" />
      <button class="upload-preview-rm" type="button" aria-label="Remove">✕</button>
      <div class="preview-badge">NEW</div>`;
    item.querySelector('.upload-preview-rm').addEventListener('click', () => {
      item.remove(); URL.revokeObjectURL(url);
      selectedImageFiles = selectedImageFiles.filter(f => f !== file);
      setZoneLabel('imgZoneLabel',
        selectedImageFiles.length ? `${selectedImageFiles.length} ready` : '');
      if (!selectedImageFiles.length) $('imgFiles').value = '';
    });
    $('imgPreviews').appendChild(item);
  });
  setZoneLabel('imgZoneLabel', `${files.length} file${files.length > 1 ? 's' : ''} ready`);
}

function onVideoSelected() {
  const file = $('vidFile').files[0];
  if (!file) return;
  selectedVideoFile = file;
  setZoneLabel('vidZoneLabel', `${file.name} — ${fmt(file.size)}`);
}

// Replace blob previews with real Cloudinary thumbnails after upload
function appendNewPreviews(urls) {
  $('imgPreviews').querySelectorAll('.preview-pending').forEach(el => el.remove());
  urls.forEach(url => {
    const item = document.createElement('div');
    item.className = 'upload-preview-item';
    item.dataset.url = url;
    item.innerHTML = `
      <img src="${url}" alt="Uploaded" loading="lazy" />
      <button class="upload-preview-rm" type="button" aria-label="Remove">✕</button>`;
    item.querySelector('.upload-preview-rm').addEventListener('click', () => {
      existingImageUrls = existingImageUrls.filter(u => u !== url);
      item.remove();
    });
    $('imgPreviews').appendChild(item);
  });
}

// ── Drag-and-drop ─────────────────────────────────────────
function setupDrop(zoneId, inputId, handler) {
  const zone  = $(zoneId);
  const input = $(inputId);
  if (!zone || !input) return;
  ['dragenter','dragover'].forEach(e =>
    zone.addEventListener(e, ev => { ev.preventDefault(); zone.classList.add('dragover'); })
  );
  ['dragleave','dragend'].forEach(e =>
    zone.addEventListener(e, () => zone.classList.remove('dragover'))
  );
  zone.addEventListener('drop', e => {
    e.preventDefault(); zone.classList.remove('dragover');
    if (!e.dataTransfer?.files?.length) return;
    const dt = new DataTransfer();
    Array.from(e.dataTransfer.files).forEach(f => dt.items.add(f));
    input.files = dt.files;
    handler();
  });
}

// ── UI helpers ────────────────────────────────────────────
function showFormError(msg) {
  const el = $('formError');
  el.textContent = `✕ ${msg}`; el.hidden = false;
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
function setStatus(t)  { $('saveBtnText').innerHTML = `<span class="spinner"></span> ${t}`; }
function resetStatus() { $('saveBtnText').textContent = $('editProductId').value ? 'Update Product' : 'Save Product'; }
function showProgress(){ const w = $('imgProgress'); if (w) w.hidden = false; }
function hideProgress(){ const w = $('imgProgress'); if (w) w.hidden = true; setProgressBar(0); }
function setProgressBar(p){ const f = $('imgProgressFill'); if (f) f.style.width = `${Math.min(100,Math.max(0,p))}%`; }
function setZoneLabel(id, t){ const el = $(id); if (el) el.textContent = t; }
function fmt(b) {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b/1024).toFixed(1)} KB`;
  return `${(b/1048576).toFixed(1)} MB`;
}

// ── Boot ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (!$('saveProductBtn')) return;

  $('saveProductBtn').addEventListener('click', saveProduct);
  $('resetFormBtn')?.addEventListener('click', resetForm);
  $('imgFiles')?.addEventListener('change', onImagesSelected);
  $('vidFile')?.addEventListener('change', onVideoSelected);

  $('fPrice')?.addEventListener('input', updatePriceHint);
  $('fPriceCurrency')?.addEventListener('change', () => {
    updatePriceHint();
    const cur = $('fPriceCurrency')?.value || 'USD';
    if ($('fPrice')) $('fPrice').placeholder = cur === 'PHP' ? `e.g. ${(100 * getPhpRate()).toFixed(0)}.00` : 'e.g. 100.00';
  });

  setupDrop('imgZone', 'imgFiles', onImagesSelected);
  setupDrop('vidZone', 'vidFile',  onVideoSelected);

  document.addEventListener('admin:editProduct', e => {
    const p = adminProducts.find(x => x.id === e.detail);
    if (!p) return;
    populateForm(p);
    navigateTo('add-product');
  });

  document.querySelectorAll('[data-nav="add-product"]').forEach(btn =>
    btn.addEventListener('click', () => { resetForm(); navigateTo('add-product'); })
  );
});
