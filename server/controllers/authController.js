/**
 * server/controllers/authController.js
 * Handles admin authentication:
 *   — login  (Firebase Auth REST → verify admin role → issue JWT)
 *   — logout (clear cookie)
 *   — verify (check current token)
 */

'use strict';

const { db }       = require('../config/firebase');
const { signToken } = require('../middleware/auth');
const logger       = require('../utils/logger');

const COOKIE_OPTIONS = {
  httpOnly:  true,                                          // not accessible via JS
  secure:    process.env.NODE_ENV === 'production',         // HTTPS only in prod
  sameSite:  'strict',                                      // CSRF mitigation
  maxAge:    8 * 60 * 60 * 1000,                           // 8 hours
  path:      '/',
};

// ── login ──────────────────────────────────────────────────
async function login(req, res) {
  const { email, password } = req.body;

  try {
    // 1. Verify credentials against Firebase Auth REST API
    const fetchFn = (await import('node-fetch')).default;
    const firebaseUrl =
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword` +
      `?key=${process.env.FIREBASE_WEB_API_KEY}`;

    const fbRes = await fetchFn(firebaseUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, password, returnSecureToken: true }),
    });

    const fbData = await fbRes.json();

    if (!fbRes.ok || fbData.error) {
      logger.security('LOGIN_FAILED', req, `email=${email}`);
      // Generic message — don't reveal whether email or password was wrong
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    // 2. Confirm this user has an admin record in Firestore
    const adminSnap = await db.collection('admin_users')
      .where('email', '==', email)
      .where('role',  '==', 'admin')
      .limit(1)
      .get();

    if (adminSnap.empty) {
      logger.security('LOGIN_NOT_ADMIN', req, `email=${email}`);
      return res.status(403).json({ error: 'Access forbidden.' });
    }

    // 3. Issue JWT
    const token = signToken({ uid: fbData.localId, email });

    // 4. Set httpOnly cookie AND return token in body
    //    (cookie for browser clients; body token for API/mobile clients)
    res.cookie('adminToken', token, COOKIE_OPTIONS);
    logger.info(`Admin login: ${email}`);

    return res.status(200).json({
      success:   true,
      token,
      expiresIn: process.env.JWT_EXPIRES_IN || '8h',
      email,
    });
  } catch (err) {
    logger.error('Login controller error: ' + err.message);
    return res.status(500).json({ error: 'Authentication service error.' });
  }
}

// ── logout ─────────────────────────────────────────────────
function logout(req, res) {
  res.clearCookie('adminToken', { path: '/' });
  logger.info(`Admin logout: ${req.admin?.email}`);
  return res.status(200).json({ success: true, message: 'Logged out.' });
}

// ── verify ─────────────────────────────────────────────────
function verify(req, res) {
  // If we reach here, verifyToken middleware has already confirmed validity
  return res.status(200).json({
    valid: true,
    admin: {
      uid:   req.admin.uid,
      email: req.admin.email,
      role:  req.admin.role,
    },
  });
}

module.exports = { login, logout, verify };
