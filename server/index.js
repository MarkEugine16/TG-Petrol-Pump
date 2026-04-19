/**
 * server/index.js
 * Express application entry point.
 * Wires together middleware, routes, and static file serving.
 */

'use strict';

require('dotenv').config();

// Validate critical env vars before doing anything else
const REQUIRED_ENV = [
  'JWT_SECRET',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_STORAGE_BUCKET',
  'FIREBASE_SERVICE_ACCOUNT_KEY',
  'FIREBASE_WEB_API_KEY',
];
const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length) {
  console.error(`[FATAL] Missing required environment variables: ${missing.join(', ')}`);
  console.error('Copy .env.example to .env and fill in all values.');
  process.exit(1);
}

const express      = require('express');
const path         = require('path');
const cookieParser = require('cookie-parser');
const logger       = require('./utils/logger');

const {
  helmetMiddleware,
  corsMiddleware,
  apiLimiter,
  noSqlSanitize,
} = require('./middleware/security');

const authRoutes     = require('./routes/auth');
const productRoutes  = require('./routes/products');
const uploadRoutes   = require('./routes/upload');

const app = express();

// ── Trust proxy (for correct IP behind Nginx/load balancer) ─
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// ── Security Middleware (applied first) ─────────────────────
app.use(helmetMiddleware);
app.use(corsMiddleware);

// ── Body parsers ────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));
app.use(cookieParser());

// ── NoSQL injection sanitizer ────────────────────────────────
app.use(noSqlSanitize);

// ── General API rate limiter ─────────────────────────────────
app.use('/api', apiLimiter);

// ── Static files ─────────────────────────────────────────────
// Public storefront
app.use(express.static(path.join(__dirname, '../public'), {
  etag:         true,
  lastModified: true,
  maxAge:       '1h',
}));

// Admin panel — served at /admin/*
app.use('/admin', express.static(path.join(__dirname, '../admin'), {
  etag:         true,
  lastModified: true,
  maxAge:       '10m',
}));

// ── API Routes ────────────────────────────────────────────────
app.use('/api/auth',     authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/upload',   uploadRoutes);

// ── Health check ──────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── SPA Fallbacks ─────────────────────────────────────────────
app.get('/admin', (_req, res) => {
  res.sendFile(path.join(__dirname, '../admin/login.html'));
});
app.get('/admin/*', (_req, res) => {
  res.sendFile(path.join(__dirname, '../admin/dashboard.html'));
});
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ── Global Error Handler ──────────────────────────────────────
// Must have 4 params for Express to recognise as error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  // Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File too large.' });
  }
  if (err.code === 'LIMIT_FILE_COUNT') {
    return res.status(400).json({ error: 'Too many files.' });
  }
  if (err.message?.includes('CORS')) {
    return res.status(403).json({ error: err.message });
  }

  // Log internal errors (do NOT send stack to client)
  logger.error(`Unhandled error [${req.method} ${req.path}]: ${err.stack || err.message}`);

  const status = err.status || err.statusCode || 500;
  return res.status(status).json({
    error: process.env.NODE_ENV === 'production'
      ? 'An internal error occurred.'
      : err.message,
  });
});

// ── Start server ──────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || 3000);
app.listen(PORT, () => {
  logger.info(`TG Petrol Pump server running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
});

module.exports = app; // for testing
