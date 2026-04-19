/**
 * server/controllers/uploadController.js
 *
 * Media uploads via Cloudinary.
 * Firebase Storage is no longer used — Firestore and Auth remain on Firebase.
 *
 * Cloudinary organises files into folders:
 *   tg-petrol-pump/products/{productId}/images/
 *   tg-petrol-pump/products/{productId}/videos/
 *
 * All uploaded files are returned as HTTPS URLs and saved to Firestore
 * by the calling code (productController).
 */

'use strict';

const cloudinary = require('cloudinary').v2;
const { sanitizeText, sanitizeUrl } = require('../utils/sanitize');
const logger = require('../utils/logger');

// ── Cloudinary is configured once in server/config/cloudinary.js ──────
// (imported automatically when this module loads)
require('../config/cloudinary');

// ─────────────────────────────────────────────────────────────────────
// Helper: upload a Buffer to Cloudinary and return the secure URL.
// ─────────────────────────────────────────────────────────────────────
function uploadBuffer(buffer, options) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) return reject(error);
      resolve(result);
    });
    stream.end(buffer);
  });
}

// ─────────────────────────────────────────────────────────────────────
// Helper: extract the Cloudinary public_id from a secure_url.
// Cloudinary URLs look like:
//   https://res.cloudinary.com/{cloud}/image/upload/v123/{public_id}.jpg
// ─────────────────────────────────────────────────────────────────────
function publicIdFromUrl(url) {
  try {
    // Strip query string, then extract everything after /upload/v{number}/
    const clean   = url.split('?')[0];
    const match   = clean.match(/\/upload\/(?:v\d+\/)?(.+)$/);
    if (!match) return null;
    // Remove file extension
    return match[1].replace(/\.[^.]+$/, '');
  } catch {
    return null;
  }
}

// ── POST /api/upload/image ─────────────────────────────────────────
async function uploadImages(req, res) {
  const productId = sanitizeText(req.body.productId);
  const files     = req.files;

  if (!files || files.length === 0) {
    return res.status(400).json({ error: 'No image files provided.' });
  }

  try {
    const results = await Promise.all(files.map(file =>
      uploadBuffer(file.buffer, {
        folder:          `tg-petrol-pump/products/${productId}/images`,
        resource_type:   'image',
        // Auto-convert to WebP for smaller size, keep quality high
        transformation:  [{ quality: 'auto', fetch_format: 'auto' }],
        // Use the original filename (sanitised) as the public_id
        use_filename:     true,
        unique_filename:  true,
        overwrite:        false,
      })
    ));

    const urls = results.map(r => r.secure_url);
    logger.info(`Cloudinary: ${urls.length} image(s) uploaded for product ${productId} by ${req.admin.email}`);
    return res.status(200).json({ success: true, urls });

  } catch (err) {
    logger.error('uploadImages (Cloudinary) error: ' + err.message);
    return res.status(500).json({ error: 'Image upload failed. ' + err.message });
  }
}

// ── POST /api/upload/video ─────────────────────────────────────────
async function uploadVideo(req, res) {
  const productId = sanitizeText(req.body.productId);
  const file      = req.file;

  if (!file) {
    return res.status(400).json({ error: 'No video file provided.' });
  }

  try {
    const result = await uploadBuffer(file.buffer, {
      folder:         `tg-petrol-pump/products/${productId}/videos`,
      resource_type:  'video',
      // Generate a thumbnail automatically; keep original quality
      eager: [{ format: 'mp4', quality: 'auto' }],
      use_filename:    true,
      unique_filename: true,
      overwrite:       false,
    });

    logger.info(`Cloudinary: video uploaded for product ${productId} by ${req.admin.email}`);
    return res.status(200).json({ success: true, url: result.secure_url });

  } catch (err) {
    logger.error('uploadVideo (Cloudinary) error: ' + err.message);
    return res.status(500).json({ error: 'Video upload failed. ' + err.message });
  }
}

// ── DELETE /api/upload/file ────────────────────────────────────────
async function deleteFile(req, res) {
  const fileUrl = sanitizeUrl(req.body.fileUrl);

  if (!fileUrl) {
    return res.status(400).json({ error: 'A valid HTTPS fileUrl is required.' });
  }

  // Only allow deletion of files inside our project folder
  if (!fileUrl.includes('tg-petrol-pump/')) {
    logger.security('CLOUDINARY_DELETE_BLOCKED', req, `url=${fileUrl}`);
    return res.status(403).json({ error: 'Cannot delete files outside the project folder.' });
  }

  const publicId = publicIdFromUrl(fileUrl);
  if (!publicId) {
    return res.status(400).json({ error: 'Could not parse file identifier from URL.' });
  }

  try {
    // Detect resource type from URL path segment
    const resourceType = fileUrl.includes('/video/') ? 'video' : 'image';
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });

    logger.info(`Cloudinary: file deleted "${publicId}" by ${req.admin.email}`);
    return res.status(200).json({ success: true });

  } catch (err) {
    logger.error('deleteFile (Cloudinary) error: ' + err.message);
    return res.status(500).json({ error: 'Failed to delete file.' });
  }
}

module.exports = { uploadImages, uploadVideo, deleteFile };
