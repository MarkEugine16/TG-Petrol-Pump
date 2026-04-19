
const BASE = '/api';

// ── Token helpers ──────────────────────────────────────────
function getToken() {
  return localStorage.getItem('tg_admin_token') || '';
}

function authHeaders(extra = {}) {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

function handleAuthError() {
  localStorage.removeItem('tg_admin_token');
  window.location.href = '/admin/login.html';
}

// ── Generic JSON request ───────────────────────────────────
async function request(method, path, body = null) {
  const opts = {
    method,
    headers: authHeaders(),
    credentials: 'include',
  };
  if (body !== null) opts.body = JSON.stringify(body);

  const res  = await fetch(`${BASE}${path}`, opts);

  if (res.status === 401 || res.status === 403) {
    handleAuthError();
    return;
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// ── XHR upload helper (supports progress) ─────────────────
/**
 * Upload a FormData payload via XHR so we get progress events.
 * @param {string}   url
 * @param {FormData} formData
 * @param {function} [onProgress]  - called with 0–100 percent
 * @returns {Promise<object>}      - parsed JSON response
 */
function xhrUpload(url, formData, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr   = new XMLHttpRequest();
    const token = getToken();

    xhr.open('POST', url, true);
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.withCredentials = true;

    // Progress callback
    if (typeof onProgress === 'function') {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      });
    }

    xhr.addEventListener('load', () => {
      if (xhr.status === 401 || xhr.status === 403) {
        handleAuthError();
        return reject(new Error('Session expired.'));
      }

      let data;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        return reject(new Error('Invalid server response.'));
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(data);
      } else {
        reject(new Error(data.error || `Upload failed (HTTP ${xhr.status})`));
      }
    });

    xhr.addEventListener('error',  () => reject(new Error('Network error during upload.')));
    xhr.addEventListener('abort',  () => reject(new Error('Upload cancelled.')));

    xhr.send(formData);
  });
}

// ══════════════════════════════════════════════════════════
// Auth
// ══════════════════════════════════════════════════════════

export async function apiLogin(email, password) {
  const res = await fetch(`${BASE}/auth/login`, {
    method:      'POST',
    headers:     { 'Content-Type': 'application/json' },
    credentials: 'include',
    body:        JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Login failed.');
  return data;
}

export async function apiVerify() {
  return request('GET', '/auth/verify');
}

export async function apiLogout() {
  return request('POST', '/auth/logout');
}

// ══════════════════════════════════════════════════════════
// Products
// ══════════════════════════════════════════════════════════

export async function apiGetProducts(params = {}) {
  const q = new URLSearchParams(params).toString();
  return request('GET', `/products${q ? `?${q}` : ''}`);
}

export async function apiCreateProduct(data) {
  return request('POST', '/products', data);
}

export async function apiUpdateProduct(id, data) {
  return request('PUT', `/products/${encodeURIComponent(id)}`, data);
}

export async function apiDeleteProduct(id) {
  return request('DELETE', `/products/${encodeURIComponent(id)}`);
}

export async function apiToggleFeatured(id) {
  return request('PATCH', `/products/${encodeURIComponent(id)}/featured`);
}

export async function apiUpdateStock(id, stock, availability) {
  return request('PATCH', `/products/${encodeURIComponent(id)}/stock`, { stock, availability });
}

// ══════════════════════════════════════════════════════════
// Upload  — uses XHR for real progress reporting
// ══════════════════════════════════════════════════════════

/**
 * Upload multiple image files to Firebase Storage.
 *
 * @param {string}     productId   - Firestore product document ID
 * @param {File[]}     files       - Array of File objects from <input type="file">
 * @param {function}   [onProgress]- Called with 0–100
 * @returns {Promise<{ success: boolean, urls: string[] }>}
 */
export async function apiUploadImages(productId, files, onProgress) {
  if (!productId) throw new Error('productId is required for image upload.');
  if (!files || files.length === 0) throw new Error('No image files provided.');

  const formData = new FormData();
  formData.append('productId', productId);

  // IMPORTANT: append each file individually with the field name 'images'
  // multer's array('images', 10) expects repeated 'images' fields
  for (const file of files) {
    formData.append('images', file, file.name);
  }

  return xhrUpload(`${BASE}/upload/image`, formData, onProgress);
}

/**
 * Upload a single video file to Firebase Storage.
 *
 * @param {string}   productId
 * @param {File}     file
 * @param {function} [onProgress]
 * @returns {Promise<{ success: boolean, url: string }>}
 */
export async function apiUploadVideo(productId, file, onProgress) {
  if (!productId) throw new Error('productId is required for video upload.');
  if (!file)      throw new Error('No video file provided.');

  const formData = new FormData();
  formData.append('productId', productId);
  formData.append('video', file, file.name);   // multer single('video')

  return xhrUpload(`${BASE}/upload/video`, formData, onProgress);
}

/**
 * Delete a file from Firebase Storage.
 * @param {string} fileUrl - Full HTTPS URL returned from upload
 */
export async function apiDeleteFile(fileUrl) {
  return request('DELETE', '/upload/file', { fileUrl });
}
