/**
 * server/controllers/settingsController.js
 * Store-wide settings persisted in Firestore.
 *
 * Document: settings/store  (single document)
 * Fields:
 *   theme        'dark' | 'light'
 *   currency     'USD' | 'PHP'
 *   phpRate      number
 *   logoUrl      string (Cloudinary URL)
 *   contactPhone string
 *   contactEmail string
 *   updatedAt    timestamp
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const { db, admin } = require('../config/firebase');
const logger = require('../utils/logger');

const DOC_REF = () => db.collection('settings').doc('store');

const DEFAULTS = {
  theme:        'dark',
  currency:     'USD',
  phpRate:      56.50,
  logoUrl:      '',
  contactPhone: '',
  contactEmail: 'sales@tgpetrol.com',
};

// ── In-memory settings cache ──────────────────────────────
// Avoids a Firestore read on every page request.
// Invalidated immediately when admin saves settings.
let _cache     = null;
let _cacheTime = 0;
const CACHE_TTL = 30_000; // 30 seconds

async function getCachedSettings() {
  if (_cache && (Date.now() - _cacheTime) < CACHE_TTL) return _cache;
  const doc  = await DOC_REF().get();
  _cache     = doc.exists ? { ...DEFAULTS, ...doc.data() } : { ...DEFAULTS };
  _cacheTime = Date.now();
  return _cache;
}

function invalidateCache() { _cache = null; }

// ── Storefront HTML (read once at startup) ────────────────
const INDEX_HTML = fs.readFileSync(
  path.join(__dirname, '../../public/index.html'),
  'utf8'
);

// ── GET / and SPA fallback  (theme pre-injected) ──────────
// Injects the correct theme class into <html> before the
// browser parses a single byte of CSS — zero flash, zero JS.
async function serveStorefront(_req, res) {
  try {
    const settings = await getCachedSettings();
    const theme    = settings.theme || 'dark';
    const html     = theme === 'light'
      ? INDEX_HTML.replace('<html lang="en">', '<html lang="en" class="light-theme">')
      : INDEX_HTML;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store'); // always serve fresh theme
    return res.send(html);
  } catch {
    // Fallback: serve the file as-is if Firestore is unreachable
    return res.sendFile(path.join(__dirname, '../../public/index.html'));
  }
}

// ── GET /api/settings  (public) ──────────────────────────
async function getSettings(req, res) {
  try {
    const doc = await DOC_REF().get();
    const data = doc.exists ? { ...DEFAULTS, ...doc.data() } : DEFAULTS;
    // Never expose internal fields
    const { updatedAt, ...safe } = data;
    return res.status(200).json(safe);
  } catch (err) {
    logger.error('getSettings error: ' + err.message);
    return res.status(500).json({ error: 'Failed to load settings.' });
  }
}

// ── PUT /api/settings  (admin only) ─────────────────────
async function updateSettings(req, res) {
  try {
    const allowed = ['theme', 'currency', 'phpRate', 'logoUrl', 'contactPhone', 'contactEmail'];
    const updates = {};

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields provided.' });
    }

    updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();

    await DOC_REF().set(updates, { merge: true });

    // Bust the in-memory cache so the next page load reflects the new theme
    invalidateCache();

    logger.info(`Settings updated by ${req.admin.email}: ${Object.keys(updates).join(', ')}`);
    return res.status(200).json({ success: true, ...updates });
  } catch (err) {
    logger.error('updateSettings error: ' + err.message);
    return res.status(500).json({ error: 'Failed to save settings.' });
  }
}

module.exports = { getSettings, updateSettings, serveStorefront };
