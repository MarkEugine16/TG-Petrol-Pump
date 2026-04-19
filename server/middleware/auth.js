/**
 * server/middleware/auth.js
 * JWT authentication middleware.
 * — Reads token from Authorization: Bearer <token> header OR httpOnly cookie.
 * — Verifies signature and expiry.
 * — Attaches decoded payload to req.admin.
 */

'use strict';

const jwt    = require('jsonwebtoken');
const logger = require('../utils/logger');

/**
 * Middleware: require a valid JWT.
 * Denies access with 401/403 if missing or invalid.
 */
function verifyToken(req, res, next) {
  // 1. Try Authorization header
  const authHeader = req.headers['authorization'];
  let token = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  }

  // 2. Fall back to httpOnly cookie
  if (!token && req.cookies && req.cookies.adminToken) {
    token = req.cookies.adminToken;
  }

  if (!token) {
    logger.security('MISSING_TOKEN', req);
    return res.status(401).json({ error: 'Authentication required.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ['HS256'],
    });

    // Ensure role is admin
    if (decoded.role !== 'admin') {
      logger.security('FORBIDDEN_ROLE', req, `role=${decoded.role}`);
      return res.status(403).json({ error: 'Access forbidden.' });
    }

    req.admin = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      logger.security('TOKEN_EXPIRED', req);
      return res.status(401).json({ error: 'Session expired. Please log in again.' });
    }
    logger.security('INVALID_TOKEN', req, err.message);
    return res.status(403).json({ error: 'Invalid token.' });
  }
}

/**
 * Generate a signed JWT for an admin user.
 * @param {{ uid: string, email: string }} payload
 * @returns {string}
 */
function signToken(payload) {
  return jwt.sign(
    { uid: payload.uid, email: payload.email, role: 'admin' },
    process.env.JWT_SECRET,
    {
      algorithm: 'HS256',
      expiresIn: process.env.JWT_EXPIRES_IN || '8h',
    }
  );
}

module.exports = { verifyToken, signToken };
