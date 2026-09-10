// ============================================================================
// NARI NIKETAN — High-Performance Image Optimization Service
// ============================================================================
'use strict';

const sharp = require('sharp');
const https = require('https');
const http = require('http');
const crypto = require('crypto');
const { bucket } = require('../config/firebase');
const logger = require('../utils/logger');
const { BadRequestError } = require('../utils/errors');

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/avif'];
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15MB

// Predefined target dimensions and quality tokens
const VARIANT_CONFIGS = {
  thumbnail: { width: 400,  quality: 82, format: 'webp' },
  medium:    { width: 800,  quality: 84, format: 'webp' },
  large:     { width: 1400, quality: 86, format: 'webp' },
  original:  { width: 1800, quality: 90, format: 'jpeg' }
};

/**
 * Validate raw image buffer
 * @param {Buffer} buffer
 */
async function validateImageBuffer(buffer) {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new BadRequestError('Invalid file: empty or corrupted buffer.');
  }

  if (buffer.length > MAX_UPLOAD_BYTES) {
    throw new BadRequestError(`File size exceeds maximum allowed limit of ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB.`);
  }

  try {
    const metadata = await sharp(buffer).metadata();
    if (!metadata || !metadata.format) {
      throw new BadRequestError('Unsupported or corrupted image format.');
    }
    return metadata;
  } catch (err) {
    throw new BadRequestError(`Image validation failed: ${err.message}`);
  }
}

/**
 * Generate all 4 optimized image variants from buffer
 * @param {Buffer} buffer
 */
async function generateVariants(buffer) {
  const meta = await validateImageBuffer(buffer);

  const startTime = Date.now();
  const variants = {};

  // 1. Thumbnail (WebP ~400px wide, target 30-80 KB)
  variants.thumbnail = await sharp(buffer)
    .rotate()
    .resize({ width: VARIANT_CONFIGS.thumbnail.width, withoutEnlargement: true })
    .webp({ quality: VARIANT_CONFIGS.thumbnail.quality, effort: 4 })
    .toBuffer();

  // 2. Medium (WebP ~800px wide, target 90-200 KB)
  variants.medium = await sharp(buffer)
    .rotate()
    .resize({ width: VARIANT_CONFIGS.medium.width, withoutEnlargement: true })
    .webp({ quality: VARIANT_CONFIGS.medium.quality, effort: 4 })
    .toBuffer();

  // 3. Large (WebP ~1400px wide, target 250-450 KB)
  variants.large = await sharp(buffer)
    .rotate()
    .resize({ width: VARIANT_CONFIGS.large.width, withoutEnlargement: true })
    .webp({ quality: VARIANT_CONFIGS.large.quality, effort: 4 })
    .toBuffer();

  // 4. Optimized Original / Fallback (JPEG max 1800px)
  variants.original = await sharp(buffer)
    .rotate()
    .resize({ width: VARIANT_CONFIGS.original.width, withoutEnlargement: true })
    .jpeg({ quality: VARIANT_CONFIGS.original.quality, mozjpeg: true })
    .toBuffer();

  const durationMs = Date.now() - startTime;
  logger.info(`Image variants generated in ${durationMs}ms | Original: ${(buffer.length / 1024).toFixed(1)}KB | Thumb: ${(variants.thumbnail.length / 1024).toFixed(1)}KB (${Math.round((1 - variants.thumbnail.length / buffer.length) * 100)}% reduction)`);

  return { variants, metadata: meta };
}

/**
 * Upload a single variant buffer to Firebase Storage with immutable caching headers
 * @param {Buffer} buffer
 * @param {string} destinationPath
 * @param {string} contentType
 */
async function uploadToStorage(buffer, destinationPath, contentType) {
  const file = bucket.file(destinationPath);

  await file.save(buffer, {
    metadata: {
      contentType,
      cacheControl: 'public, max-age=31536000, immutable'
    },
    resumable: false
  });

  // Make public or generate standard CDN URL
  try {
    await file.makePublic();
  } catch (e) {
    // If uniform bucket-level access is enabled, makePublic is a no-op / handled by IAM
  }

  // Construct canonical public CDN / Firebase Storage URL
  return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(destinationPath)}?alt=media`;
}

/**
 * Full Pipeline: Validate, generate multi-variants, and upload to Firebase Storage
 * @param {Buffer} buffer
 * @param {Object} options { productId, sellerId, alt }
 */
async function processAndUploadProductImage(buffer, options = {}) {
  const { productId = 'temp', sellerId = 'seller', alt = '' } = options;
  const fileId = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

  const { variants, metadata } = await generateVariants(buffer);

  const basePath = `products/${sellerId}/${productId}`;

  const [thumbUrl, medUrl, largeUrl, origUrl] = await Promise.all([
    uploadToStorage(variants.thumbnail, `${basePath}/thumbnail/${fileId}.webp`, 'image/webp'),
    uploadToStorage(variants.medium,    `${basePath}/medium/${fileId}.webp`,    'image/webp'),
    uploadToStorage(variants.large,     `${basePath}/large/${fileId}.webp`,     'image/webp'),
    uploadToStorage(variants.original,  `${basePath}/original/${fileId}.jpg`,   'image/jpeg'),
  ]);

  return {
    thumbnail: thumbUrl,
    medium: medUrl,
    large: largeUrl,
    original: origUrl,
    alt: alt || 'Product Image',
    width: metadata.width || 800,
    height: metadata.height || 1000,
    aspectRatio: metadata.width && metadata.height ? `${metadata.width}/${metadata.height}` : '3/4',
    fileId
  };
}

/**
 * Helper to download an image from a URL into a Buffer
 * @param {string} url
 */
function downloadImageBuffer(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      if (res.statusCode !== 200) {
        return reject(new Error(`Failed to download image from ${url}: Status ${res.statusCode}`));
      }
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', err => reject(err));
    }).on('error', err => reject(err));
  });
}

/**
 * Migrate/optimize an existing product image by URL
 * @param {string} imageUrl
 * @param {Object} options
 */
async function optimizeFromUrl(imageUrl, options = {}) {
  if (!imageUrl || typeof imageUrl !== 'string' || imageUrl.startsWith('data:')) {
    throw new BadRequestError('Invalid or base64 image URL cannot be migrated via URL.');
  }

  const buffer = await downloadImageBuffer(imageUrl);
  return await processAndUploadProductImage(buffer, options);
}

module.exports = {
  validateImageBuffer,
  generateVariants,
  processAndUploadProductImage,
  optimizeFromUrl,
  ALLOWED_MIME_TYPES,
  MAX_UPLOAD_BYTES,
  VARIANT_CONFIGS
};
