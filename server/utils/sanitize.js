/**
 * server/utils/sanitize.js
 * Input sanitization helpers.
 * — Strip HTML/XSS from strings
 * — Sanitize nested objects recursively
 * — Validate file MIME types
 */

'use strict';

const xss = require('xss');

/**
 * XSS options — strip all HTML tags and attributes.
 * We do NOT allow any HTML in product fields except description,
 * which uses a restricted whitelist.
 */
const STRICT_XSS_OPTIONS = {
  whiteList: {},          // no tags allowed
  stripIgnoreTag: true,
  stripIgnoreTagBody: ['script', 'style'],
};

const DESCRIPTION_XSS_OPTIONS = {
  whiteList: {
    b: [], strong: [], i: [], em: [], u: [], br: [],
    p: [], ul: [], ol: [], li: [], h3: [], h4: [],
    span: ['style'], a: ['href', 'target'],
  },
  stripIgnoreTag: true,
  stripIgnoreTagBody: ['script', 'style', 'iframe', 'object'],
};

/**
 * Sanitize a plain text string — remove all HTML.
 * @param {*} value
 * @returns {string}
 */
function sanitizeText(value) {
  if (typeof value !== 'string') return '';
  return xss(value.trim(), STRICT_XSS_OPTIONS);
}

/**
 * Sanitize rich-text HTML (product descriptions).
 * Allows a safe subset of HTML tags.
 * @param {*} value
 * @returns {string}
 */
function sanitizeHtml(value) {
  if (typeof value !== 'string') return '';
  return xss(value.trim(), DESCRIPTION_XSS_OPTIONS);
}

/**
 * Recursively sanitize all string values in an object.
 * Leaves numbers, booleans, and arrays intact.
 * @param {object} obj
 * @param {string[]} [htmlFields] - field names that allow safe HTML
 * @returns {object}
 */
function sanitizeObject(obj, htmlFields = []) {
  if (typeof obj !== 'object' || obj === null) return obj;
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (Array.isArray(value)) {
      result[key] = value.map(item =>
        typeof item === 'string'
          ? sanitizeText(item)
          : sanitizeObject(item, htmlFields)
      );
    } else if (typeof value === 'string') {
      result[key] = htmlFields.includes(key)
        ? sanitizeHtml(value)
        : sanitizeText(value);
    } else if (typeof value === 'object' && value !== null) {
      result[key] = sanitizeObject(value, htmlFields);
    } else {
      result[key] = value; // number, boolean, null
    }
  }
  return result;
}

/**
 * Allowed MIME types for image uploads.
 */
const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

/**
 * Allowed MIME types for video uploads.
 */
const ALLOWED_VIDEO_TYPES = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
]);

/**
 * Check whether a MIME type is an allowed image type.
 * @param {string} mimetype
 * @returns {boolean}
 */
function isAllowedImage(mimetype) {
  return ALLOWED_IMAGE_TYPES.has(mimetype);
}

/**
 * Check whether a MIME type is an allowed video type.
 * @param {string} mimetype
 * @returns {boolean}
 */
function isAllowedVideo(mimetype) {
  return ALLOWED_VIDEO_TYPES.has(mimetype);
}

/**
 * Sanitize a URL — only allow http/https schemes.
 * @param {string} url
 * @returns {string}
 */
function sanitizeUrl(url) {
  if (typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) return '';
  return trimmed;
}

module.exports = {
  sanitizeText,
  sanitizeHtml,
  sanitizeObject,
  sanitizeUrl,
  isAllowedImage,
  isAllowedVideo,
  ALLOWED_IMAGE_TYPES,
  ALLOWED_VIDEO_TYPES,
};
