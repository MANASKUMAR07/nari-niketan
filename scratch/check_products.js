const { execSync } = require('child_process');
const https = require('https');

const token = execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim();

const req = https.request('https://firestore.googleapis.com/v1/projects/nari-niketan/databases/(default)/documents/products?pageSize=5', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
}, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    try {
      const data = JSON.parse(body);
      console.log('Found documents:', data.documents ? data.documents.length : 0);
      if (data.documents) {
        data.documents.forEach((doc, idx) => {
          console.log(`\n=== Product ${idx + 1} (${doc.name.split('/').pop()}) ===`);
          const fields = doc.fields || {};
          console.log('Name:', fields.name ? fields.name.stringValue : 'N/A');
          console.log('Category:', fields.category ? fields.category.stringValue : 'N/A');
          console.log('imageUrl:', fields.imageUrl ? fields.imageUrl.stringValue?.slice(0, 70) + '...' : 'none');
          if (fields.images) {
            console.log('images type:', fields.images.arrayValue ? 'array' : 'other');
            if (fields.images.arrayValue && fields.images.arrayValue.values) {
              fields.images.arrayValue.values.forEach((v, i) => {
                console.log(`  image[${i}]:`, v.stringValue ? v.stringValue.slice(0, 70) + '...' : JSON.stringify(v));
              });
            }
          }
          console.log('imageVariants:', fields.imageVariants ? JSON.stringify(fields.imageVariants) : 'none');
        });
      }
    } catch (e) {
      console.error('Parse error:', e, body);
    }
  });
});

req.on('error', (e) => console.error('Req error:', e));
req.end();
