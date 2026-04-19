/**
 * public/js/api.js
 * Thin HTTP client for the public storefront.
 * No auth headers — all calls are read-only public endpoints.
 */

const BASE = '/api';

/**
 * Fetch all products with optional filters.
 * @param {{ category?: string, search?: string, limit?: number, startAfter?: string }} opts
 * @returns {Promise<{ products: object[], lastId: string|null, count: number }>}
 */
export async function fetchProducts(opts = {}) {
  const params = new URLSearchParams();
  if (opts.category && opts.category !== 'all') params.set('category', opts.category);
  if (opts.search)     params.set('search',    opts.search);
  if (opts.limit)      params.set('limit',     opts.limit);
  if (opts.startAfter) params.set('startAfter', opts.startAfter);

  const res = await fetch(`${BASE}/products?${params}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/**
 * Fetch a single product by ID.
 * @param {string} id
 * @returns {Promise<object>}
 */
export async function fetchProduct(id) {
  const res = await fetch(`${BASE}/products/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/**
 * Increment the view count for a product (fire-and-forget).
 * @param {string} id
 */
export function trackView(id) {
  fetch(`${BASE}/products/${encodeURIComponent(id)}/view`, { method: 'POST' })
    .catch(() => {/* non-critical */});
}
