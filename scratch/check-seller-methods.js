const fs = require('fs');
const content = fs.readFileSync('./seller/seller.js', 'utf8');

// Check all this.<method> in SellerProducts
const sellerProductsMatch = content.match(/const SellerProducts = \{([\s\S]*?)\n\};/);
if (sellerProductsMatch) {
  const spBody = sellerProductsMatch[1];
  const methodCalls = [...spBody.matchAll(/this\.([a-zA-Z0-9_]+)\s*\(/g)].map(m => m[1]);
  const definedMethods = [...spBody.matchAll(/^\s*([a-zA-Z0-9_]+)\s*\([^)]*\)\s*\{/gm)].map(m => m[1]);
  console.log('Defined methods in SellerProducts:', definedMethods);
  console.log('Called this.<method> in SellerProducts:', [...new Set(methodCalls)]);
  const missing = [...new Set(methodCalls)].filter(m => !definedMethods.includes(m));
  console.log('MISSING methods in SellerProducts called with this.<method>():', missing);
}

// Check all SellerWizard.<method> calls across the entire file
const wizardDefined = [...content.matchAll(/const SellerWizard = \{([\s\S]*?)\n\};/g)][0];
if (wizardDefined) {
  const wizBody = wizardDefined[1];
  const definedWizMethods = [...wizBody.matchAll(/^\s*([a-zA-Z0-9_]+)\s*\([^)]*\)\s*\{/gm)].map(m => m[1]);
  const wizardCalls = [...content.matchAll(/SellerWizard\.([a-zA-Z0-9_]+)\s*\(/g)].map(m => m[1]);
  console.log('\nDefined methods in SellerWizard:', definedWizMethods);
  const missingWiz = [...new Set(wizardCalls)].filter(m => !definedWizMethods.includes(m));
  console.log('MISSING methods in SellerWizard called:', missingWiz);
}

// Check all SellerVariants.<method> calls across the entire file
const variantsDefined = [...content.matchAll(/const SellerVariants = \{([\s\S]*?)\n\};/g)][0];
if (variantsDefined) {
  const varBody = variantsDefined[1];
  const definedVarMethods = [...varBody.matchAll(/^\s*([a-zA-Z0-9_]+)\s*\([^)]*\)\s*\{/gm)].map(m => m[1]);
  const variantCalls = [...content.matchAll(/SellerVariants\.([a-zA-Z0-9_]+)\s*\(/g)].map(m => m[1]);
  console.log('\nDefined methods in SellerVariants:', definedVarMethods);
  const missingVar = [...new Set(variantCalls)].filter(m => !definedVarMethods.includes(m));
  console.log('MISSING methods in SellerVariants called:', missingVar);
}

// Check all SellerInventory.<method> calls
const invDefined = [...content.matchAll(/const SellerInventory = \{([\s\S]*?)\n\};/g)][0];
if (invDefined) {
  const invBody = invDefined[1];
  const definedInvMethods = [...invBody.matchAll(/^\s*([a-zA-Z0-9_]+)\s*\([^)]*\)\s*\{/gm)].map(m => m[1]);
  const invCalls = [...content.matchAll(/SellerInventory\.([a-zA-Z0-9_]+)\s*\(/g)].map(m => m[1]);
  console.log('\nDefined methods in SellerInventory:', definedInvMethods);
  const missingInv = [...new Set(invCalls)].filter(m => !definedInvMethods.includes(m));
  console.log('MISSING methods in SellerInventory called:', missingInv);
}
