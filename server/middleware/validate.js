/**
 * server/middleware/validate.js
 * Input validation chains using express-validator.
 * Each export is an array of validation rules + the handleValidation
 * middleware that short-circuits with 422 if any rule fails.
 */

'use strict';

const { body, param, query, validationResult } = require('express-validator');

/**
 * Middleware: run after validation chains.
 * Returns 422 with all error messages if validation failed.
 */
function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // Return errors without leaking internal paths or stack traces
    const messages = errors.array().map(e => ({
      field:   e.path || e.param,
      message: e.msg,
    }));
    return res.status(422).json({ error: 'Validation failed.', details: messages });
  }
  next();
}

// ─── Auth ─────────────────────────────────────────────────

const loginRules = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('A valid email address is required.'),
  body('password')
    .isString()
    .trim()
    .isLength({ min: 6, max: 128 })
    .withMessage('Password must be 6–128 characters.'),
];

// ─── Products ─────────────────────────────────────────────

const createProductRules = [
  body('name')
    .isString().trim()
    .notEmpty().withMessage('Product name is required.')
    .isLength({ max: 200 }).withMessage('Name must be ≤ 200 characters.'),

  body('category')
    .isIn(['fuel-dispensers', 'spare-parts', 'accessories'])
    .withMessage('Category must be one of: fuel-dispensers, spare-parts, accessories.'),

  body('price')
    .isFloat({ min: 0 })
    .withMessage('Price must be a non-negative number.'),

  body('discountPercent')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Discount must be between 0 and 100.'),

  body('stock')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Stock must be a non-negative integer.'),

  body('availability')
    .optional()
    .isIn(['in-stock', 'out-of-stock', 'coming-soon'])
    .withMessage('Availability must be: in-stock, out-of-stock, or coming-soon.'),

  body('description')
    .optional()
    .isString()
    .isLength({ max: 10000 })
    .withMessage('Description must be ≤ 10 000 characters.'),

  body('images')
    .optional()
    .isArray({ max: 20 })
    .withMessage('Images must be an array of up to 20 URLs.'),

  body('images.*')
    .optional()
    .isURL({ protocols: ['https'], require_protocol: true })
    .withMessage('Each image must be a valid HTTPS URL.'),

  body('videos')
    .optional()
    .isArray({ max: 5 })
    .withMessage('Videos must be an array of up to 5 URLs.'),

  body('videos.*')
    .optional()
    .isURL({ protocols: ['https'], require_protocol: true })
    .withMessage('Each video must be a valid HTTPS URL.'),

  body('featured')
    .optional()
    .isBoolean()
    .withMessage('Featured must be a boolean.'),

  body('specifications')
    .optional()
    .isObject()
    .withMessage('Specifications must be an object.'),
];

const updateProductRules = [
  param('id')
    .isString().trim().notEmpty()
    .withMessage('Product ID is required in the URL.'),
  // Reuse create rules but all are optional on update
  ...createProductRules.map(rule => rule.optional()),
];

const productIdRule = [
  param('id')
    .isString().trim().notEmpty()
    .withMessage('Product ID is required.'),
];

const stockUpdateRules = [
  param('id').isString().trim().notEmpty().withMessage('Product ID required.'),
  body('stock')
    .isInt({ min: 0 })
    .withMessage('Stock must be a non-negative integer.'),
  body('availability')
    .optional()
    .isIn(['in-stock', 'out-of-stock', 'coming-soon'])
    .withMessage('Invalid availability value.'),
];

// ─── Upload ───────────────────────────────────────────────

const uploadRules = [
  body('productId')
    .isString().trim().notEmpty()
    .withMessage('productId is required.'),
];

const deleteFileRules = [
  body('fileUrl')
    .isURL({ protocols: ['https'], require_protocol: true })
    .withMessage('fileUrl must be a valid HTTPS URL.'),
];

module.exports = {
  handleValidation,
  loginRules,
  createProductRules,
  updateProductRules,
  productIdRule,
  stockUpdateRules,
  uploadRules,
  deleteFileRules,
};
