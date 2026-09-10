const https = require('https');
const { execSync } = require('child_process');

const token = execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim();

const req = https.request('https://firestore.googleapis.com/v1/projects/nari-niketan/databases/(default)/documents/products?pageSize=5', {
  headers: { 'Authorization': `Bearer ${token}` }
}, (res) => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => {
    const data = JSON.parse(body);
    console.log(`Fetched ${data.documents.length} products from Firestore:\n`);

    data.documents.forEach((doc, idx) => {
      const name = doc.fields.name?.stringValue || 'Unnamed';
      const thumb = doc.fields.thumbnail?.stringValue || '';
      console.log(`[Product ${idx + 1}] "${name}"`);
      console.log(`  Thumbnail URL: ${thumb}`);

      if (thumb) {
        https.get(thumb, (imgRes) => {
          console.log(`  ✓ Public Anonymous HTTP Status: ${imgRes.statusCode} (${imgRes.headers['content-type']}, ${imgRes.headers['content-length']} bytes)\n`);
        }).on('error', err => console.error('  ❌ Error:', err.message));
      }
    });
  });
});
req.end();
