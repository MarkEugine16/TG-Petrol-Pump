/**
 * server/routes/auth.js
 * Mount at: /api/auth
 */

'use strict';

const express = require('express');
const router  = express.Router();

const { verifyToken }                  = require('../middleware/auth');
const { loginRules, handleValidation } = require('../middleware/validate');
const { loginLimiter, loginSlowDown }  = require('../middleware/security');
const { login, logout, verify }        = require('../controllers/authController');

// POST /api/auth/login  — rate-limited + validated
router.post(
  '/login',
  loginLimiter,
  loginSlowDown,
  loginRules,
  handleValidation,
  login
);

// POST /api/auth/logout — requires valid token
router.post('/logout', verifyToken, logout);

// GET  /api/auth/verify — check if current token is valid
router.get('/verify', verifyToken, verify);

module.exports = router;
