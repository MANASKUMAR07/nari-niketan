const fs = require('fs');

const html = fs.readFileSync('./seller/index.html', 'utf8');
const js = fs.readFileSync('./seller/seller.js', 'utf8');

// Find all on<event>="Seller..." in HTML
const eventCalls = [...html.matchAll(/on[a-z]+="([^"]+)"/gi)].map(m => m[1]);
console.log('Total event handlers in HTML:', eventCalls.length);

const missingCalls = [];

eventCalls.forEach(call => {
  // Extract statements separated by ;
  const statements = call.split(';');
  statements.forEach(stmt => {
    stmt = stmt.trim();
    if (!stmt) return;
    const match = stmt.match(/^(Seller[A-Za-z0-9]+)\.([A-Za-z0-9_]+)\s*\(/);
    if (match) {
      const objName = match[1];
      const methodName = match[2];

      // Check if objName exists in js
      const objRegex = new RegExp(`const\\s+${objName}\\s*=\\s*\\{([\\s\\S]*?)\\n\\};`);
      const objMatch = js.match(objRegex);
      if (!objMatch) {
        missingCalls.push({ call: stmt, reason: `Object ${objName} not found` });
      } else {
        const body = objMatch[1];
        // Check if methodName is defined as a method or property in obj
        const methodRegex = new RegExp(`(^|\\s)${methodName}\\s*\\(`, 'm');
        const asyncMethodRegex = new RegExp(`(^|\\s)async\\s+${methodName}\\s*\\(`, 'm');
        if (!methodRegex.test(body) && !asyncMethodRegex.test(body)) {
          missingCalls.push({ obj: objName, method: methodName, call: stmt });
        }
      }
    }
  });
});

console.log('Missing/Unimplemented HTML Handler Calls:', missingCalls);
