
'use strict';

const express = require('express');
const router  = express.Router();
const { verifyToken }             = require('../middleware/auth');
const { getSettings, updateSettings } = require('../controllers/settingsController');

// Public — storefront reads this on every page load
router.get('/',  getSettings);

// Admin only — settings page saves here
router.put('/',  verifyToken, updateSettings);

module.exports = router;
