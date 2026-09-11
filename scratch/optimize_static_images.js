const fs = require('fs');
const path = require('path');
const sharp = require('../backend/node_modules/sharp');

const IMAGES_DIR = path.join(__dirname, '..', 'frontend', 'images');
const CATEGORIES_DIR = path.join(IMAGES_DIR, 'categories');

async function optimizeImage(inputPath, webpPath, optOrigPath = null, options = {}) {
  const origStats = fs.statSync(inputPath);
  const origSize = origStats.size;

  const maxWidth = options.maxWidth || 1200;
  const webpQuality = options.webpQuality || 82;
  const origQuality = options.origQuality || 80;

  // 1. Generate WebP
  let pipelineWebp = sharp(inputPath);
  if (options.resize) {
    pipelineWebp = pipelineWebp.resize({ width: maxWidth, withoutEnlargement: true });
  }
  await pipelineWebp
    .webp({ quality: webpQuality, effort: 6 })
    .toFile(webpPath);

  const webpStats = fs.statSync(webpPath);
  const webpSize = webpStats.size;

  // 2. Optional: overwrite / optimize original format as fallback
  let optOrigSize = origSize;
  if (optOrigPath) {
    const ext = path.extname(inputPath).toLowerCase();
    const tempOptPath = optOrigPath + '.tmp';
    let pipelineOrig = sharp(inputPath);
    if (options.resize) {
      pipelineOrig = pipelineOrig.resize({ width: maxWidth, withoutEnlargement: true });
    }

    if (ext === '.png') {
      await pipelineOrig
        .png({ compressionLevel: 9, adaptiveFiltering: true, quality: origQuality })
        .toFile(tempOptPath);
    } else if (ext === '.jpg' || ext === '.jpeg') {
      await pipelineOrig
        .jpeg({ quality: origQuality, mozjpeg: true })
        .toFile(tempOptPath);
    }

    if (fs.existsSync(tempOptPath)) {
      const tempStats = fs.statSync(tempOptPath);
      if (tempStats.size < origSize) {
        fs.renameSync(tempOptPath, optOrigPath);
        optOrigSize = tempStats.size;
      } else {
        fs.unlinkSync(tempOptPath);
      }
    }
  }

  return {
    file: path.basename(inputPath),
    origSize,
    webpSize,
    optOrigSize,
    savedPercent: Math.round(((origSize - webpSize) / origSize) * 100)
  };
}

async function run() {
  console.log('🚀 Starting Static Asset Optimization...\n');
  const results = [];

  // Logo images
  const logoCircle = path.join(IMAGES_DIR, 'logo-circle.png');
  const logoCircleWebp = path.join(IMAGES_DIR, 'logo-circle.webp');
  if (fs.existsSync(logoCircle)) {
    results.push(await optimizeImage(logoCircle, logoCircleWebp, logoCircle, { maxWidth: 512, webpQuality: 88, origQuality: 85 }));
  }

  const logoEmblem = path.join(IMAGES_DIR, 'logo-emblem.png');
  const logoEmblemWebp = path.join(IMAGES_DIR, 'logo-emblem.webp');
  if (fs.existsSync(logoEmblem)) {
    results.push(await optimizeImage(logoEmblem, logoEmblemWebp, logoEmblem, { maxWidth: 512, webpQuality: 88, origQuality: 85 }));
  }

  const logoPng = path.join(IMAGES_DIR, 'logo.png');
  const logoWebp = path.join(IMAGES_DIR, 'logo.webp');
  if (fs.existsSync(logoPng)) {
    results.push(await optimizeImage(logoPng, logoWebp, logoPng, { maxWidth: 512, webpQuality: 88, origQuality: 85 }));
  }

  // Categories
  if (fs.existsSync(CATEGORIES_DIR)) {
    const catFiles = fs.readdirSync(CATEGORIES_DIR).filter(f => f.endsWith('.jpg') || f.endsWith('.png'));
    for (const file of catFiles) {
      const inputPath = path.join(CATEGORIES_DIR, file);
      const webpPath = path.join(CATEGORIES_DIR, file.replace(/\.(jpg|png|jpeg)$/i, '.webp'));
      results.push(await optimizeImage(inputPath, webpPath, inputPath, { maxWidth: 800, resize: true, webpQuality: 82, origQuality: 80 }));
    }
  }

  console.log('-----------------------------------------------------------------------------------------');
  console.log('| FILE NAME                  | ORIGINAL SIZE | OPTIMIZED WEBP | FALLBACK SIZE | SAVINGS |');
  console.log('-----------------------------------------------------------------------------------------');

  let totalOrig = 0;
  let totalWebp = 0;

  for (const r of results) {
    totalOrig += r.origSize;
    totalWebp += r.webpSize;
    const nameStr = r.file.padEnd(26);
    const origStr = `${(r.origSize / 1024).toFixed(1)} KB`.padStart(13);
    const webpStr = `${(r.webpSize / 1024).toFixed(1)} KB`.padStart(14);
    const optStr  = `${(r.optOrigSize / 1024).toFixed(1)} KB`.padStart(13);
    const saveStr = `${r.savedPercent}%`.padStart(7);
    console.log(`| ${nameStr} | ${origStr} | ${webpStr} | ${optStr} | ${saveStr} |`);
  }

  console.log('-----------------------------------------------------------------------------------------');
  console.log(`TOTAL STATIC IMAGES: Before ${(totalOrig / (1024 * 1024)).toFixed(2)} MB ➔ WebP ${(totalWebp / 1024).toFixed(1)} KB (${Math.round(((totalOrig - totalWebp) / totalOrig) * 100)}% overall reduction)`);
  console.log('-----------------------------------------------------------------------------------------\n');
}

run().catch(console.error);
