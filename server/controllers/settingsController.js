
'use strict';

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

    logger.info(`Settings updated by ${req.admin.email}: ${Object.keys(updates).join(', ')}`);
    return res.status(200).json({ success: true, ...updates });
  } catch (err) {
    logger.error('updateSettings error: ' + err.message);
    return res.status(500).json({ error: 'Failed to save settings.' });
  }
}

module.exports = { getSettings, updateSettings };
