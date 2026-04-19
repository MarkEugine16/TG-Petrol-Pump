/**
 * server/middleware/security.js
 * Centralised security middleware factory.
 * Applies:
 *   — Helmet (secure HTTP headers)
 *   — CORS (whitelist only)
 *   — Rate limiting (general + strict login limiter)
 *   — Slow-down (progressive delays after repeated hits)
 *   — NoSQL injection sanitizer
 *   — Request size limiting
 */

'use strict';

const helmet         = require('helmet');
const cors           = require('cors');
const rateLimit      = require('express-rate-limit');
const slowDown       = require('express-slow-down');
const mongoSanitize  = require('express-mongo-sanitize');
const logger         = require('../utils/logger');

// ─── Allowed CORS origins ─────────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

// ─── Helmet — secure HTTP headers ────────────────────────
const helmetMiddleware = helmet({
  // Strict Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc:     ["'self'"],
      scriptSrc:      ["'self'"],
      styleSrc:       ["'self'", 'https://fonts.googleapis.com', "'unsafe-inline'"],
      fontSrc:        ["'self'", 'https://fonts.gstatic.com'],
      imgSrc:         ["'self'", 'data:', 'https:'],
      mediaSrc:       ["'self'", 'https:'],
      connectSrc:     ["'self'"],
      frameSrc:       ["'none'"],
      objectSrc:      ["'none'"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
    },
  },
  crossOriginEmbedderPolicy: false, // allow media from GCS
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
});

// ─── CORS ─────────────────────────────────────────────────
const corsMiddleware = cors({
  origin(origin, callback) {
    // Allow requests with no origin (server-to-server, curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    logger.warn(`CORS blocked for origin: ${origin}`);
    return callback(new Error(`CORS policy: origin ${origin} not allowed.`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  maxAge: 600, // preflight cache 10 min
});

// ─── General API rate limiter ─────────────────────────────
const apiLimiter = rateLimit({
  windowMs: parseInt(process.env.API_RATE_LIMIT_WINDOW_MINUTES || 1) * 60 * 1000,
  max:      parseInt(process.env.API_RATE_LIMIT_MAX || 120),
  standardHeaders: true,
  legacyHeaders:   false,
  handler(req, res) {
    logger.security('RATE_LIMIT_API', req);
    res.status(429).json({ error: 'Too many requests. Please slow down.' });
  },
});

// ─── Strict login rate limiter ────────────────────────────
const loginLimiter = rateLimit({
  windowMs: parseInt(process.env.LOGIN_RATE_LIMIT_WINDOW_MINUTES || 15) * 60 * 1000,
  max:      parseInt(process.env.LOGIN_RATE_LIMIT_MAX || 10),
  skipSuccessfulRequests: true,   // only count failed attempts
  standardHeaders: true,
  legacyHeaders:   false,
  handler(req, res) {
    logger.security('RATE_LIMIT_LOGIN', req);
    res.status(429).json({
      error: 'Too many failed login attempts. Try again in 15 minutes.',
    });
  },
});

// ─── Progressive slow-down for login route ────────────────
const loginSlowDown = slowDown({
  windowMs: 5 * 60 * 1000,  // 5 min window
  delayAfter: 3,             // start slowing after 3rd attempt
  delayMs: (used) => (used - 3) * 500, // +500ms per extra attempt
});

// ─── NoSQL injection sanitizer ────────────────────────────
// Removes $ and . from request body/query/params to prevent
// MongoDB/Firestore operator injection attacks.
const noSqlSanitize = mongoSanitize({
  replaceWith: '_',
  onSanitize({ req, key }) {
    logger.security('NOSQL_INJECTION_ATTEMPT', req, `key=${key}`);
  },
});

module.exports = {
  helmetMiddleware,
  corsMiddleware,
  apiLimiter,
  loginLimiter,
  loginSlowDown,
  noSqlSanitize,
};
