// ============================================================================
// NARI NIKETAN — Image Controller
// ============================================================================
'use strict';

const imageService = require('../services/imageService');
const { db } = require('../config/firebase');
const logger = require('../utils/logger');
const { BadRequestError, NotFoundError, ForbiddenError } = require('../utils/errors');

/**
 * Handle multipart product image upload and generate variants
 */
async function uploadProductImage(req, res, next) {
  try {
    if (!req.file || !req.file.buffer) {
      throw new BadRequestError('No image file provided.');
    }

    const sellerId = req.user.uid;
    const productId = req.body.productId || `prod_${Date.now()}`;
    const alt = req.body.alt || req.body.name || 'Product Image';

    const result = await imageService.processAndUploadProductImage(req.file.buffer, {
      productId,
      sellerId,
      alt
    });

    return res.status(201).json({
      success: true,
      message: 'Image processed and variants generated successfully.',
      image: result
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Handle multiple product images upload
 */
async function uploadProductImages(req, res, next) {
  try {
    if (!req.files || !req.files.length) {
      throw new BadRequestError('No image files provided.');
    }

    const sellerId = req.user.uid;
    const productId = req.body.productId || `prod_${Date.now()}`;
    const alt = req.body.alt || req.body.name || 'Product Image';

    const results = await Promise.all(
      req.files.map((file, idx) =>
        imageService.processAndUploadProductImage(file.buffer, {
          productId,
          sellerId,
          alt: `${alt} - ${idx + 1}`
        })
      )
    );

    return res.status(201).json({
      success: true,
      message: `${results.length} images processed and variants generated successfully.`,
      images: results,
      thumbnail: results[0]?.thumbnail || '',
      imageUrl: results[0]?.large || results[0]?.medium || ''
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Backfill / Optimize an existing product in Firestore by ID
 */
async function optimizeExistingProduct(req, res, next) {
  try {
    const { productId } = req.params;
    const productRef = db.collection('products').doc(productId);
    const snap = await productRef.get();

    if (!snap.exists) {
      throw new NotFoundError(`Product ${productId} not found.`);
    }

    const data = snap.data();
    // Security: only owner/admin or owning seller can trigger optimization
    if (!req.user.admin && !req.user.owner && data.sellerId !== req.user.uid) {
      throw new ForbiddenError('You do not have permission to optimize this product.');
    }

    const existingImages = Array.isArray(data.images) ? data.images : (data.imageUrl ? [data.imageUrl] : []);
    if (!existingImages.length) {
      return res.json({ success: true, message: 'No images to optimize on this product.', product: data });
    }

    const optimizedVariants = [];
    for (let i = 0; i < existingImages.length; i++) {
      const item = existingImages[i];
      // If already an optimized variant object, keep it
      if (typeof item === 'object' && item.thumbnail) {
        optimizedVariants.push(item);
        continue;
      }

      if (typeof item === 'string' && item.startsWith('http')) {
        try {
          const opt = await imageService.optimizeFromUrl(item, {
            productId,
            sellerId: data.sellerId || req.user.uid,
            alt: data.name || 'Product'
          });
          optimizedVariants.push(opt);
        } catch (e) {
          logger.warn(`Failed to optimize legacy image for product ${productId}: ${e.message}`);
          // Fallback to original string if download fails
          optimizedVariants.push({ original: item, thumbnail: item, medium: item, large: item });
        }
      }
    }

    const updatePayload = {
      images: optimizedVariants,
      imageUrl: optimizedVariants[0]?.large || optimizedVariants[0]?.medium || data.imageUrl,
      thumbnail: optimizedVariants[0]?.thumbnail || data.imageUrl,
      imagesOptimizedAt: new Date()
    };

    await productRef.update(updatePayload);

    return res.json({
      success: true,
      message: `Product ${productId} images optimized successfully.`,
      product: { ...data, ...updatePayload }
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  uploadProductImage,
  uploadProductImages,
  optimizeExistingProduct
};
