/**
 * server/config/cloudinary.js
 * Cloudinary SDK — singleton configuration.
 * Called once at server startup; all other modules just require('cloudinary').v2.
 */

'use strict';

const cloudinary = require('cloudinary').v2;
const logger     = require('../utils/logger');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure:     true, // always use HTTPS URLs
});

// Quick sanity-check at startup
if (!process.env.CLOUDINARY_CLOUD_NAME ||
    !process.env.CLOUDINARY_API_KEY    ||
    !process.env.CLOUDINARY_API_SECRET) {
  logger.error('Cloudinary credentials missing. Check CLOUDINARY_* in .env');
  process.exit(1);
}

logger.info(`Cloudinary configured for cloud: ${process.env.CLOUDINARY_CLOUD_NAME}`);

module.exports = cloudinary;
