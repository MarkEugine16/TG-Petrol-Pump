/**
 * server/routes/products.js
 * Mount at: /api/products
 */

'use strict';

const express = require('express');
const router  = express.Router();

const { verifyToken } = require('../middleware/auth');
const {
  createProductRules,
  updateProductRules,
  productIdRule,
  stockUpdateRules,
  handleValidation,
} = require('../middleware/validate');

const {
  getAll, getOne, create, update, remove,
  toggleFeatured, updateStock, incrementView,
} = require('../controllers/productController');

// ── Public routes ─────────────────────────────────────────
router.get('/',                                  getAll);
router.get('/:id',    productIdRule, handleValidation, getOne);
router.post('/:id/view', productIdRule, handleValidation, incrementView);

// ── Admin-only routes ─────────────────────────────────────
router.post(
  '/',
  verifyToken,
  createProductRules, handleValidation,
  create
);

router.put(
  '/:id',
  verifyToken,
  updateProductRules, handleValidation,
  update
);

router.delete(
  '/:id',
  verifyToken,
  productIdRule, handleValidation,
  remove
);

router.patch(
  '/:id/featured',
  verifyToken,
  productIdRule, handleValidation,
  toggleFeatured
);

router.patch(
  '/:id/stock',
  verifyToken,
  stockUpdateRules, handleValidation,
  updateStock
);

module.exports = router;
