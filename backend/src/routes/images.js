// ============================================================================
// NARI NIKETAN — Image Processing & Upload Routes
// ============================================================================
'use strict';

const express = require('express');
const multer  = require('multer');
const router  = express.Router();

const imageController = require('../controllers/imageController');
const { authenticateFirebaseUser, requireSeller } = require('../middleware/auth');
const { standardLimiter } = require('../middleware/rateLimiter');
const { BadRequestError } = require('../utils/errors');

// Memory storage for fast in-memory Sharp processing
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB max file size
    files: 5
  },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new BadRequestError('Only image files (JPEG, PNG, WebP) are allowed.'), false);
    }
    cb(null, true);
  }
});

// Single image upload & variant generation (Seller)
router.post(
  '/upload',
  standardLimiter,
  authenticateFirebaseUser,
  requireSeller,
  upload.single('image'),
  imageController.uploadProductImage
);

// Multiple image upload & variant generation (Seller)
router.post(
  '/upload-multiple',
  standardLimiter,
  authenticateFirebaseUser,
  requireSeller,
  upload.array('images', 5),
  imageController.uploadProductImages
);

// Optimize existing product images in Firestore by ID (Admin / Seller)
router.post(
  '/optimize-product/:productId',
  standardLimiter,
  authenticateFirebaseUser,
  requireSeller,
  imageController.optimizeExistingProduct
);

module.exports = router;
