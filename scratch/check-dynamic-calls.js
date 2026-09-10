const fs = require('fs');

const js = fs.readFileSync('./seller/seller.js', 'utf8');

// Find all onclick="Seller..." inside template literals in seller.js
const dynamicCalls = [...js.matchAll(/onclick=["'](Seller[A-Za-z0-9]+\.[A-Za-z0-9_]+)\s*\(/g)].map(m => m[1]);
console.log('Dynamic onclick calls in seller.js:', dynamicCalls);

const missing = [];
dynamicCalls.forEach(call => {
  const [objName, methodName] = call.split('.');
  const objRegex = new RegExp(`const\\s+${objName}\\s*=\\s*\\{([\\s\\S]*?)\\n\\};`);
  const objMatch = js.match(objRegex);
  if (!objMatch) {
    missing.push({ objName, methodName });
  } else {
    const body = objMatch[1];
    const methodRegex = new RegExp(`(^|\\s)${methodName}\\s*\\(`, 'm');
    const asyncMethodRegex = new RegExp(`(^|\\s)async\\s+${methodName}\\s*\\(`, 'm');
    if (!methodRegex.test(body) && !asyncMethodRegex.test(body)) {
      missing.push({ objName, methodName });
    }
  }
});

console.log('Missing dynamic methods:', missing);
