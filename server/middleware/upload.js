/**
 * server/middleware/upload.js
 * Multer configuration for image and video uploads.
 * — In-memory storage (streamed directly to Firebase Storage).
 * — MIME type and magic-byte validation.
 * — Per-file size limits.
 */

'use strict';

const multer = require('multer');
const { isAllowedImage, isAllowedVideo } = require('../utils/sanitize');
const logger = require('../utils/logger');

// ─── Magic byte signatures ────────────────────────────────
// Basic file-type sniffing on the first bytes of the buffer
// to prevent disguised uploads (e.g., .php renamed to .jpg).
const IMAGE_SIGNATURES = [
  { bytes: [0xFF, 0xD8, 0xFF], type: 'image/jpeg' },               // JPEG
  { bytes: [0x89, 0x50, 0x4E, 0x47], type: 'image/png' },          // PNG
  { bytes: [0x52, 0x49, 0x46, 0x46], type: 'image/webp' },         // WEBP (RIFF)
  { bytes: [0x47, 0x49, 0x46], type: 'image/gif' },                 // GIF
];
const VIDEO_SIGNATURES = [
  { bytes: [0x00, 0x00, 0x00], type: 'video/mp4' },                 // MP4 (partial)
  { bytes: [0x1A, 0x45, 0xDF, 0xA3], type: 'video/webm' },         // WEBM
];

function checkMagicBytes(buffer, signatures) {
  return signatures.some(sig =>
    sig.bytes.every((byte, i) => buffer[i] === byte)
  );
}

// ─── Multer storage (memory) ──────────────────────────────
const memoryStorage = multer.memoryStorage();

// ─── Image uploader ───────────────────────────────────────
const imageUpload = multer({
  storage: memoryStorage,
  limits: {
    fileSize: parseInt(process.env.MAX_IMAGE_SIZE_MB || 5) * 1024 * 1024,
    files: 10,
  },
  fileFilter(req, file, cb) {
    if (!isAllowedImage(file.mimetype)) {
      logger.security('INVALID_IMAGE_MIME', req, `mimetype=${file.mimetype}`);
      return cb(new Error(`Unsupported image type: ${file.mimetype}. Allowed: JPEG, PNG, WEBP, GIF.`));
    }
    cb(null, true);
  },
});

// ─── Video uploader ───────────────────────────────────────
const videoUpload = multer({
  storage: memoryStorage,
  limits: {
    fileSize: parseInt(process.env.MAX_VIDEO_SIZE_MB || 100) * 1024 * 1024,
    files: 1,
  },
  fileFilter(req, file, cb) {
    if (!isAllowedVideo(file.mimetype)) {
      logger.security('INVALID_VIDEO_MIME', req, `mimetype=${file.mimetype}`);
      return cb(new Error(`Unsupported video type: ${file.mimetype}. Allowed: MP4, WEBM, MOV.`));
    }
    cb(null, true);
  },
});

/**
 * Post-upload magic-byte validation middleware (image).
 * Runs after multer has stored the file in memory.
 */
function validateImageBytes(req, res, next) {
  const files = req.files || (req.file ? [req.file] : []);
  for (const file of files) {
    if (!checkMagicBytes(file.buffer, IMAGE_SIGNATURES)) {
      logger.security('MAGIC_BYTE_FAIL_IMAGE', req, `original=${file.originalname}`);
      return res.status(400).json({
        error: 'File content does not match a valid image format.',
      });
    }
  }
  next();
}

/**
 * Post-upload magic-byte validation middleware (video).
 */
function validateVideoBytes(req, res, next) {
  if (!req.file) return next();
  if (!checkMagicBytes(req.file.buffer, VIDEO_SIGNATURES)) {
    logger.security('MAGIC_BYTE_FAIL_VIDEO', req, `original=${req.file.originalname}`);
    return res.status(400).json({
      error: 'File content does not match a valid video format.',
    });
  }
  next();
}

module.exports = {
  imageUpload,
  videoUpload,
  validateImageBytes,
  validateVideoBytes,
};
