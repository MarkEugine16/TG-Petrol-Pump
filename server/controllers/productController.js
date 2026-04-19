/**
 * server/controllers/productController.js
 * Full CRUD for products, plus view-count tracking, featured toggle,
 * and stock management.
 *
 * All writes are admin-only (enforced via verifyToken in routes).
 * All reads are public.
 */

'use strict';

const { db, admin } = require('../config/firebase');
const { sanitizeObject, sanitizeText } = require('../utils/sanitize');
const logger = require('../utils/logger');

const COLLECTION = 'products';
const FieldValue = admin.firestore.FieldValue;

// ─── Helpers ──────────────────────────────────────────────

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function calcFinalPrice(price, discountPercent) {
  if (!discountPercent || discountPercent <= 0) return parseFloat(price);
  return parseFloat((price * (1 - discountPercent / 100)).toFixed(2));
}

function inferAvailability(stock, availability) {
  if (availability) return availability;
  return parseInt(stock) > 0 ? 'in-stock' : 'out-of-stock';
}

/**
 * Build a safe product document from raw request body.
 * Sanitizes all string fields.
 */
function buildProductDoc(body, isUpdate = false) {
  const {
    name, category, description, specifications,
    price, discountPercent, stock, availability,
    images, videos, featured,
  } = body;

  const doc = {};

  if (name !== undefined)
    doc.name = sanitizeText(name);

  if (category !== undefined)
    doc.category = sanitizeText(category);

  if (description !== undefined) {
    // Allow safe HTML in descriptions
    const { sanitizeHtml } = require('../utils/sanitize');
    doc.description = sanitizeHtml(description);
  }

  if (specifications !== undefined)
    doc.specifications = sanitizeObject(specifications);

  if (price !== undefined) {
    doc.price = parseFloat(price);
    const disc = parseFloat(discountPercent) || 0;
    doc.discountPercent = disc;
    doc.finalPrice = calcFinalPrice(doc.price, disc);
  } else if (discountPercent !== undefined) {
    doc.discountPercent = parseFloat(discountPercent);
  }

  if (stock !== undefined)
    doc.stock = parseInt(stock);

  if (availability !== undefined)
    doc.availability = sanitizeText(availability);

  // Auto-set availability from stock if not explicit
  if (stock !== undefined && !availability)
    doc.availability = inferAvailability(stock, null);

  if (images !== undefined)
    doc.images = (images || []).map(u => sanitizeText(u)).filter(Boolean);

  if (videos !== undefined)
    doc.videos = (videos || []).map(u => sanitizeText(u)).filter(Boolean);

  if (featured !== undefined)
    doc.featured = Boolean(featured);

  doc.updatedAt = FieldValue.serverTimestamp();

  if (!isUpdate) {
    doc.views     = 0;
    doc.createdAt = FieldValue.serverTimestamp();
    if (doc.name) doc.slug = slugify(doc.name);
  }

  return doc;
}

// ─── Controllers ──────────────────────────────────────────

/**
 * GET /api/products
 * Public. Supports ?category, ?featured, ?limit, ?startAfter, ?search
 */
async function getAll(req, res) {
  try {
    const {
      category, featured,
      limit = 50, startAfter,
      search,
    } = req.query;

    let q = db.collection(COLLECTION).orderBy('createdAt', 'desc');

    if (category && category !== 'all')
      q = q.where('category', '==', sanitizeText(category));

    if (featured === 'true')
      q = q.where('featured', '==', true);

    if (startAfter) {
      const startDoc = await db.collection(COLLECTION).doc(sanitizeText(startAfter)).get();
      if (startDoc.exists) q = q.startAfter(startDoc);
    }

    const safeLimit = Math.min(parseInt(limit) || 50, 100);
    q = q.limit(safeLimit);

    const snapshot = await q.get();
    let products   = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Client-side full-text search (Firestore lacks native FTS)
    if (search) {
      const term = sanitizeText(search).toLowerCase();
      products = products.filter(p =>
        p.name?.toLowerCase().includes(term) ||
        p.category?.toLowerCase().includes(term)
      );
    }

    const lastId = snapshot.docs.at(-1)?.id || null;
    return res.status(200).json({ products, lastId, count: products.length });
  } catch (err) {
    logger.error('getAll error: ' + err.message);
    return res.status(500).json({ error: 'Failed to fetch products.' });
  }
}

/**
 * GET /api/products/:id
 * Public.
 */
async function getOne(req, res) {
  try {
    const doc = await db.collection(COLLECTION).doc(req.params.id).get();
    if (!doc.exists)
      return res.status(404).json({ error: 'Product not found.' });
    return res.status(200).json({ id: doc.id, ...doc.data() });
  } catch (err) {
    logger.error('getOne error: ' + err.message);
    return res.status(500).json({ error: 'Failed to fetch product.' });
  }
}

/**
 * POST /api/products
 * Admin only.
 */
async function create(req, res) {
  try {
    const doc = buildProductDoc(req.body, false);

    if (!doc.name || !doc.category || doc.price === undefined) {
      return res.status(400).json({ error: 'name, category, and price are required.' });
    }

    const ref = await db.collection(COLLECTION).add(doc);
    logger.info(`Product created: ${ref.id} by ${req.admin.email}`);
    return res.status(201).json({ id: ref.id, ...doc });
  } catch (err) {
    logger.error('create error: ' + err.message);
    return res.status(500).json({ error: 'Failed to create product.' });
  }
}

/**
 * PUT /api/products/:id
 * Admin only.
 */
async function update(req, res) {
  try {
    const ref = db.collection(COLLECTION).doc(req.params.id);
    const existing = await ref.get();
    if (!existing.exists)
      return res.status(404).json({ error: 'Product not found.' });

    const updates = buildProductDoc(req.body, true);

    // Recalculate final price with merged price/discount
    const prevData = existing.data();
    const price = updates.price ?? prevData.price;
    const disc  = updates.discountPercent ?? prevData.discountPercent ?? 0;
    updates.finalPrice = calcFinalPrice(price, disc);

    await ref.update(updates);
    logger.info(`Product updated: ${req.params.id} by ${req.admin.email}`);
    return res.status(200).json({ id: req.params.id, ...updates });
  } catch (err) {
    logger.error('update error: ' + err.message);
    return res.status(500).json({ error: 'Failed to update product.' });
  }
}

/**
 * DELETE /api/products/:id
 * Admin only.
 */
async function remove(req, res) {
  try {
    const ref = db.collection(COLLECTION).doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists)
      return res.status(404).json({ error: 'Product not found.' });
    await ref.delete();
    logger.info(`Product deleted: ${req.params.id} by ${req.admin.email}`);
    return res.status(200).json({ success: true });
  } catch (err) {
    logger.error('remove error: ' + err.message);
    return res.status(500).json({ error: 'Failed to delete product.' });
  }
}

/**
 * PATCH /api/products/:id/featured
 * Admin only. Toggle featured flag.
 */
async function toggleFeatured(req, res) {
  try {
    const ref = db.collection(COLLECTION).doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists)
      return res.status(404).json({ error: 'Product not found.' });
    const newVal = !doc.data().featured;
    await ref.update({ featured: newVal, updatedAt: FieldValue.serverTimestamp() });
    return res.status(200).json({ featured: newVal });
  } catch (err) {
    logger.error('toggleFeatured error: ' + err.message);
    return res.status(500).json({ error: 'Failed to toggle featured.' });
  }
}

/**
 * PATCH /api/products/:id/stock
 * Admin only.
 */
async function updateStock(req, res) {
  try {
    const { stock, availability } = req.body;
    const ref = db.collection(COLLECTION).doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists)
      return res.status(404).json({ error: 'Product not found.' });

    await ref.update({
      stock:        parseInt(stock),
      availability: availability || inferAvailability(stock, null),
      updatedAt:    FieldValue.serverTimestamp(),
    });
    return res.status(200).json({ success: true });
  } catch (err) {
    logger.error('updateStock error: ' + err.message);
    return res.status(500).json({ error: 'Failed to update stock.' });
  }
}

/**
 * POST /api/products/:id/view
 * Public. Atomic increment.
 */
async function incrementView(req, res) {
  try {
    const ref = db.collection(COLLECTION).doc(req.params.id);
    await ref.update({ views: FieldValue.increment(1) });
    return res.status(200).json({ success: true });
  } catch {
    // Non-critical — don't expose errors
    return res.status(200).json({ success: false });
  }
}

module.exports = {
  getAll, getOne, create, update, remove,
  toggleFeatured, updateStock, incrementView,
};
