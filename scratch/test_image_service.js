const path = require('path');
const fs = require('fs');
const sharp = require('../backend/node_modules/sharp');
const imageService = require('../backend/src/services/imageService');

async function testImageService() {
  console.log('🧪 Testing Image Optimization Service...');

  // 1. Create a dummy test image buffer in memory (1200x1600 JPG)
  const testBuffer = await sharp({
    create: {
      width: 1200,
      height: 1600,
      channels: 3,
      background: { r: 139, g: 26, b: 74 }
    }
  }).jpeg().toBuffer();

  console.log(`Original test image created: ${(testBuffer.length / 1024).toFixed(1)} KB`);

  // 2. Test generateVariants
  const { variants, metadata } = await imageService.generateVariants(testBuffer);

  console.log('\nGenerated Variants:');
  console.log(`- Thumbnail (${imageService.VARIANT_CONFIGS.thumbnail.width}px): ${(variants.thumbnail.length / 1024).toFixed(1)} KB (WebP)`);
  console.log(`- Medium (${imageService.VARIANT_CONFIGS.medium.width}px): ${(variants.medium.length / 1024).toFixed(1)} KB (WebP)`);
  console.log(`- Large (${imageService.VARIANT_CONFIGS.large.width}px): ${(variants.large.length / 1024).toFixed(1)} KB (WebP)`);
  console.log(`- Original (${imageService.VARIANT_CONFIGS.original.width}px): ${(variants.original.length / 1024).toFixed(1)} KB (JPEG)`);

  const thumbMeta = await sharp(variants.thumbnail).metadata();
  const medMeta = await sharp(variants.medium).metadata();
  const largeMeta = await sharp(variants.large).metadata();

  console.log('\nDimension Verification:');
  console.log(`Thumbnail width: ${thumbMeta.width}px, format: ${thumbMeta.format}`);
  console.log(`Medium width: ${medMeta.width}px, format: ${medMeta.format}`);
  console.log(`Large width: ${largeMeta.width}px, format: ${largeMeta.format}`);

  if (thumbMeta.width !== 400 || thumbMeta.format !== 'webp') {
    throw new Error(`Thumbnail format/width mismatch: ${thumbMeta.width}px ${thumbMeta.format}`);
  }
  if (medMeta.width !== 800 || medMeta.format !== 'webp') {
    throw new Error(`Medium format/width mismatch: ${medMeta.width}px ${medMeta.format}`);
  }
  if (largeMeta.width !== 1200 || largeMeta.format !== 'webp') { // original was 1200, withoutEnlargement keeps it at 1200
    throw new Error(`Large format/width mismatch: ${largeMeta.width}px ${largeMeta.format}`);
  }

  // 3. Test invalid buffer rejection
  let rejected = false;
  try {
    await imageService.validateImageBuffer(Buffer.from('not an image'));
  } catch (e) {
    rejected = true;
    console.log(`\nCorrupted buffer correctly rejected: "${e.message}"`);
  }
  if (!rejected) throw new Error('Failed to reject corrupted buffer!');

  console.log('\n🎉 ALL IMAGE SERVICE UNIT TESTS PASSED (100% SUCCESS)!');
}

testImageService().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
