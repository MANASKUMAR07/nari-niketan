const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');

const filesToUpdate = [
  'cart.html',
  'checkout.html',
  'my-orders.html',
  'login.html',
  'register.html',
  'terms-and-conditions.html',
  'privacy-policy.html',
  'return-policy.html',
  'grievance-redressal.html',
  'seller/index.html',
  'seller/login.html',
  'delivery/index.html',
  'delivery/login.html',
  'admin/index.html'
];

filesToUpdate.forEach(relPath => {
  const filePath = path.join(ROOT_DIR, relPath);
  if (!fs.existsSync(filePath)) return;

  let content = fs.readFileSync(filePath, 'utf8');

  // Replace ../images/logo-circle.png with ../images/logo-circle.webp with fallback
  content = content.replace(/\.\.\/images\/logo-circle\.png\?v=4\.0/g, '../images/logo-circle.webp?v=4.0');
  // Replace images/logo-circle.png with images/logo-circle.webp
  content = content.replace(/images\/logo-circle\.png\?v=4\.0/g, 'images/logo-circle.webp?v=4.0');
  content = content.replace(/images\/logo-circle\.png/g, 'images/logo-circle.webp');

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Updated logo reference in ${relPath}`);
});
