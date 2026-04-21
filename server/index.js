/**
 * server/index.js
 * Express application entry point.
 */

'use strict';

require('dotenv').config();

// ── Required environment variable check ───────────────────
// FIREBASE_STORAGE_BUCKET removed — media is now handled by Cloudinary
const REQUIRED_ENV = [
  'JWT_SECRET',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_SERVICE_ACCOUNT_KEY',
  'FIREBASE_WEB_API_KEY',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
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
const rateLimit    = require('express-rate-limit');
const logger       = require('./utils/logger');

const {
  helmetMiddleware,
  corsMiddleware,
  apiLimiter,
  noSqlSanitize,
} = require('./middleware/security');

const authRoutes    = require('./routes/auth');
const productRoutes = require('./routes/products');
const uploadRoutes  = require('./routes/upload');

const app = express();

// Trust proxy for correct IP behind Render/Nginx
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// ── Security middleware ───────────────────────────────────
app.use(helmetMiddleware);
app.use(corsMiddleware);

// ── Body parsers ──────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));
app.use(cookieParser());

// ── NoSQL injection sanitizer ─────────────────────────────
app.use(noSqlSanitize);

// ── General API rate limiter ──────────────────────────────
app.use('/api', apiLimiter);

// ── Static files ──────────────────────────────────────────
app.use(express.static(path.join(__dirname, '../public'), {
  etag: true, lastModified: true, maxAge: '1h',
}));
app.use('/admin', express.static(path.join(__dirname, '../admin'), {
  etag: true, lastModified: true, maxAge: '10m',
}));

// ── API routes ────────────────────────────────────────────
app.use('/api/auth',     authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/upload',   uploadRoutes);

// ── Health check ──────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── SPA fallbacks ─────────────────────────────────────────
app.get('/admin', (_req, res) => {
  res.sendFile(path.join(__dirname, '../admin/login.html'));
});
app.get('/admin/*', (_req, res) => {
  res.sendFile(path.join(__dirname, '../admin/dashboard.html'));
});
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ── Global error handler ──────────────────────────────────
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'File too large.' });
  if (err.code === 'LIMIT_FILE_COUNT') return res.status(400).json({ error: 'Too many files.' });
  if (err.message?.includes('CORS')) return res.status(403).json({ error: err.message });

  logger.error(`Unhandled error [${req.method} ${req.path}]: ${err.stack || err.message}`);

  return res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'An internal error occurred.'
      : err.message,
  });
});

// ── Start ─────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || 3000);
app.listen(PORT, () => {
  logger.info(`TG Petrol Pump server running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
});

module.exports = app;
