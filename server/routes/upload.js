/**
 * server/routes/upload.js
 * Mount at: /api/upload
 * All routes require admin JWT.
 */

'use strict';

const express = require('express');
const router  = express.Router();

const { verifyToken }                       = require('../middleware/auth');
const { imageUpload, videoUpload,
        validateImageBytes, validateVideoBytes } = require('../middleware/upload');
const { uploadRules, deleteFileRules,
        handleValidation }                   = require('../middleware/validate');
const { uploadImages, uploadVideo,
        deleteFile }                          = require('../controllers/uploadController');

// POST /api/upload/image  (up to 10 files)
router.post(
  '/image',
  verifyToken,
  imageUpload.array('images', 10),
  validateImageBytes,
  uploadRules, handleValidation,
  uploadImages
);

// POST /api/upload/video  (1 file)
router.post(
  '/video',
  verifyToken,
  videoUpload.single('video'),
  validateVideoBytes,
  uploadRules, handleValidation,
  uploadVideo
);

// DELETE /api/upload/file
router.delete(
  '/file',
  verifyToken,
  deleteFileRules, handleValidation,
  deleteFile
);

module.exports = router;
