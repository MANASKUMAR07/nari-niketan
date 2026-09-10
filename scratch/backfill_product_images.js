// ============================================================================
// NARI NIKETAN — Existing Product Image Backfill & Migration Script
// ============================================================================
'use strict';

const { execSync } = require('child_process');
const https = require('https');
const http = require('http');
const sharp = require('../server/node_modules/sharp');

const PROJECT_ID = 'nari-niketan';
const BUCKET_NAME = 'nari-niketan.firebasestorage.app';

// Obtain gcloud OAuth2 access token for local authenticated execution
let token = '';
try {
  token = execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim();
} catch (e) {
  console.error('Failed to get gcloud access token. Please run gcloud auth login.');
  process.exit(1);
}

function requestJson(url, options = {}) {
  return new Promise((resolve, reject) => {
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };
    const req = (url.startsWith('https') ? https : http).request(url, {
      method: options.method || 'GET',
      headers
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(body ? JSON.parse(body) : {});
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${body}`));
          }
        } catch (err) {
          reject(err);
        }
      });
    });
    req.on('error', reject);
    if (options.body) req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    req.end();
  });
}

function downloadBuffer(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307) {
        return downloadBuffer(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Status ${res.statusCode} downloading ${url}`));
      }
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

function uploadToStorageGcs(buffer, destinationPath, contentType) {
  return new Promise((resolve, reject) => {
    const encodedPath = encodeURIComponent(destinationPath);
    const url = `https://storage.googleapis.com/upload/storage/v1/b/${BUCKET_NAME}/o?uploadType=media&name=${encodedPath}`;

    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable'
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          // Public Firebase Storage URL
          const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${BUCKET_NAME}/o/${encodeURIComponent(destinationPath)}?alt=media`;
          resolve(publicUrl);
        } else {
          reject(new Error(`Storage upload failed (${res.statusCode}): ${body}`));
        }
      });
    });
    req.on('error', reject);
    req.write(buffer);
    req.end();
  });
}

async function backfill() {
  console.log('🔄 Starting Product Image Backfill Migration...\n');

  const listUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/products?pageSize=100`;
  const data = await requestJson(listUrl);

  const docs = data.documents || [];
  console.log(`Found ${docs.length} products in Firestore.\n`);

  let migratedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const doc of docs) {
    const docId = doc.name.split('/').pop();
    const fields = doc.fields || {};
    const name = fields.name ? fields.name.stringValue : 'Unnamed';
    const sellerId = fields.sellerId ? fields.sellerId.stringValue : 'seller';
    const rawImageUrl = fields.imageUrl ? fields.imageUrl.stringValue : '';
    const hasThumbnail = fields.thumbnail && fields.thumbnail.stringValue;

    console.log(`Processing Product: "${name}" (${docId})`);

    // Check if already using firebasestorage.googleapis.com
    if (hasThumbnail && hasThumbnail.includes('firebasestorage.googleapis.com') && hasThumbnail.includes('/thumbnail/')) {
      console.log(`  ↪ Already optimized with Firebase Storage URL. Skipping.\n`);
      skippedCount++;
      continue;
    }

    if (!rawImageUrl || rawImageUrl.startsWith('data:') || rawImageUrl.includes('placehold.co')) {
      console.log(`  ↪ No valid remote image URL (${rawImageUrl.slice(0, 30)}). Skipping.\n`);
      skippedCount++;
      continue;
    }

    try {
      console.log(`  ⬇ Downloading original image from ${rawImageUrl.slice(0, 60)}...`);
      const originalBuffer = await downloadBuffer(rawImageUrl);
      console.log(`  ✓ Original image size: ${(originalBuffer.length / 1024).toFixed(1)} KB`);

      const fileId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const basePath = `products/${sellerId}/${docId}`;

      // Generate variants
      const [thumbBuf, medBuf, largeBuf, origBuf] = await Promise.all([
        sharp(originalBuffer).rotate().resize({ width: 400, withoutEnlargement: true }).webp({ quality: 82, effort: 4 }).toBuffer(),
        sharp(originalBuffer).rotate().resize({ width: 800, withoutEnlargement: true }).webp({ quality: 84, effort: 4 }).toBuffer(),
        sharp(originalBuffer).rotate().resize({ width: 1400, withoutEnlargement: true }).webp({ quality: 86, effort: 4 }).toBuffer(),
        sharp(originalBuffer).rotate().resize({ width: 1800, withoutEnlargement: true }).jpeg({ quality: 88, mozjpeg: true }).toBuffer(),
      ]);

      console.log(`  ⚡ Generated WebP variants: Thumbnail ${(thumbBuf.length / 1024).toFixed(1)} KB | Medium ${(medBuf.length / 1024).toFixed(1)} KB | Large ${(largeBuf.length / 1024).toFixed(1)} KB`);

      // Upload to Storage
      const [thumbUrl, medUrl, largeUrl, origUrl] = await Promise.all([
        uploadToStorageGcs(thumbBuf, `${basePath}/thumbnail/${fileId}.webp`, 'image/webp'),
        uploadToStorageGcs(medBuf, `${basePath}/medium/${fileId}.webp`, 'image/webp'),
        uploadToStorageGcs(largeBuf, `${basePath}/large/${fileId}.webp`, 'image/webp'),
        uploadToStorageGcs(origBuf, `${basePath}/original/${fileId}.jpg`, 'image/jpeg')
      ]);

      const variantObject = {
        thumbnail: thumbUrl,
        medium: medUrl,
        large: largeUrl,
        original: origUrl,
        alt: name
      };

      // Patch Firestore product document
      const patchUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/products/${docId}?updateMask.fieldPaths=thumbnail&updateMask.fieldPaths=imageUrl&updateMask.fieldPaths=images&updateMask.fieldPaths=imageVariants`;

      const patchBody = {
        fields: {
          ...fields,
          thumbnail: { stringValue: thumbUrl },
          imageUrl: { stringValue: largeUrl },
          images: {
            arrayValue: {
              values: [
                {
                  mapValue: {
                    fields: {
                      thumbnail: { stringValue: thumbUrl },
                      medium: { stringValue: medUrl },
                      large: { stringValue: largeUrl },
                      original: { stringValue: origUrl },
                      alt: { stringValue: name }
                    }
                  }
                }
              ]
            }
          },
          imageVariants: {
            arrayValue: {
              values: [
                {
                  mapValue: {
                    fields: {
                      thumbnail: { stringValue: thumbUrl },
                      medium: { stringValue: medUrl },
                      large: { stringValue: largeUrl },
                      original: { stringValue: origUrl },
                      alt: { stringValue: name }
                    }
                  }
                }
              ]
            }
          }
        }
      };

      await requestJson(patchUrl, { method: 'PATCH', body: patchBody });
      console.log(`  ✅ Firestore document updated with WebP variants!\n`);
      migratedCount++;
    } catch (err) {
      console.error(`  ❌ Error optimizing product ${docId}:`, err.message, '\n');
      errorCount++;
    }
  }

  console.log('====================================================');
  console.log(`🎉 BACKFILL COMPLETE!`);
  console.log(`   Migrated / Optimized: ${migratedCount}`);
  console.log(`   Skipped:              ${skippedCount}`);
  console.log(`   Errors:               ${errorCount}`);
  console.log('====================================================\n');
}

backfill().catch(console.error);
