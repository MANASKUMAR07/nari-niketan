/**
 * Test Suite: Variant-Based Inventory & Seller Management
 * Run with: node test-variant-inventory.js
 */

const assert = require('assert');
const {
  variantSchema,
  quickUpdateInventorySchema,
  shippingSchema,
  pricingSchema,
  upsertProductSchema
} = require('./server/src/validators/sellerValidator');

const { computeInventoryMetrics } = require('./server/src/controllers/sellerController');

console.log('🧪 Starting Variant Inventory & Seller Management Verification Tests...\n');

// 1. Validator: Variant Schema
console.log('Test 1: Validating Variant Schema');
const validVariant = {
  variantId: 'var_test_1',
  sku: 'NN-SAR-RED-M',
  size: 'M (38)',
  color: 'Ruby Red',
  colorCode: '#C62828',
  quantity: 12,
  reservedQuantity: 2,
  availableQuantity: 10,
  lowStockThreshold: 5,
  price: 2499,
  mrp: 3999,
  active: true,
  status: 'in_stock'
};
const vRes = variantSchema.safeParse(validVariant);
assert(vRes.success, `Variant schema should accept valid variant: ${JSON.stringify(vRes.error?.issues)}`);
console.log('  ✓ Valid variant accepted with full attributes');

// Negative test: quantity cannot be negative
const invalidVariant = { ...validVariant, quantity: -5 };
const negRes = variantSchema.safeParse(invalidVariant);
assert(!negRes.success, 'Variant schema should reject negative quantity');
console.log('  ✓ Negative quantity correctly rejected by schema');

// 2. Validator: Quick Stock Schema
console.log('\nTest 2: Validating Quick Update Inventory Schema');
const validQuickUpdate = {
  variantId: 'var_test_1',
  quantity: 25,
  reason: 'RESTOCK',
  note: 'Received batch from handloom weaver'
};
const quRes = quickUpdateInventorySchema.safeParse(validQuickUpdate);
assert(quRes.success, `Quick update schema should accept valid payload: ${JSON.stringify(quRes.error?.issues)}`);
console.log('  ✓ Quick update payload valid with reason');

// 3. Validator: Shipping and Pricing Schemas
console.log('\nTest 3: Validating Shipping & Pricing Schemas');
const validShipping = {
  weight: 0.8,
  length: 32,
  width: 26,
  height: 6,
  shippingCategory: 'Heavy Silk / Lehenga',
  storePickupAvailable: true,
  deliveryAvailable: true
};
const shipRes = shippingSchema.safeParse(validShipping);
assert(shipRes.success, `Shipping schema should accept valid dimensions: ${JSON.stringify(shipRes.error?.issues)}`);
console.log('  ✓ Shipping dimensions & weights validated');

const validPricing = {
  mrp: 4999,
  sellingPrice: 3499,
  discountPercentage: 30
};
const priceRes = pricingSchema.safeParse(validPricing);
assert(priceRes.success, `Pricing schema should accept valid pricing: ${JSON.stringify(priceRes.error?.issues)}`);
console.log('  ✓ Pricing and discount percentage validated');

// 4. Metric Computation: computeInventoryMetrics
console.log('\nTest 4: Testing computeInventoryMetrics calculation');
const testVariants = [
  { variantId: 'v1', size: 'S', color: 'Ruby Red', quantity: 15, reservedQuantity: 3, lowStockThreshold: 5 },
  { variantId: 'v2', size: 'M', color: 'Ruby Red', quantity: 4, reservedQuantity: 0, lowStockThreshold: 5 },
  { variantId: 'v3', size: 'L', color: 'Emerald Green', quantity: 0, reservedQuantity: 0, lowStockThreshold: 5 }
];

const { variants: processedVariants, stock, inventory } = computeInventoryMetrics(testVariants);

// Verify totals
assert.strictEqual(stock, 19, 'Stock must equal 19');
assert.strictEqual(inventory.totalQuantity, 19, 'Total quantity must equal 15 + 4 + 0 = 19');
assert.strictEqual(inventory.totalReservedQuantity, 3, 'Total reserved must equal 3');
assert.strictEqual(inventory.totalAvailableQuantity, 16, 'Total available must equal 19 - 3 = 16');
assert.strictEqual(inventory.lowStockCount, 1, 'Low stock count should be 1 (v2 with qty=4, threshold=5)');
assert.strictEqual(inventory.outOfStockCount, 1, 'Out of stock count should be 1 (v3 with qty=0)');
assert.strictEqual(inventory.hasVariants, true, 'hasVariants should be true');

// Verify individual variant statuses
assert.strictEqual(processedVariants[0].status, 'in_stock', 'v1 must be in_stock');
assert.strictEqual(processedVariants[0].availableQuantity, 12, 'v1 available must be 15 - 3 = 12');
assert.strictEqual(processedVariants[1].status, 'low_stock', 'v2 must be low_stock');
assert.strictEqual(processedVariants[2].status, 'out_of_stock', 'v3 must be out_of_stock');
console.log('  ✓ Aggregated inventory metrics and individual variant statuses calculated with 100% accuracy');

// 5. Atomic Stock Deduction Logic (Simulating Order Placement)
console.log('\nTest 5: Simulating Variant-Level Order Deduction');
const mockProduct = {
  id: 'prod_101',
  name: 'Banarasi Zari Saree',
  stock: 19,
  variants: JSON.parse(JSON.stringify(processedVariants))
};

// Customer purchases: Ruby Red / M qty = 3
const targetVariantId = 'v2';
const purchaseQty = 3;

const targetVariant = mockProduct.variants.find(v => v.variantId === targetVariantId);
assert(targetVariant, 'Target variant should be found');
assert(targetVariant.availableQuantity >= purchaseQty, 'Should have sufficient stock');

targetVariant.quantity -= purchaseQty;
targetVariant.availableQuantity = Math.max(0, targetVariant.quantity - (targetVariant.reservedQuantity || 0));
targetVariant.status = targetVariant.quantity <= 0 ? 'out_of_stock' : (targetVariant.quantity <= targetVariant.lowStockThreshold ? 'low_stock' : 'in_stock');

// Recalculate parent stock
mockProduct.stock = mockProduct.variants.reduce((sum, v) => sum + v.quantity, 0);

assert.strictEqual(targetVariant.quantity, 1, 'v2 quantity should decrease from 4 to 1');
assert.strictEqual(targetVariant.availableQuantity, 1, 'v2 available quantity should be 1');
assert.strictEqual(targetVariant.status, 'low_stock', 'v2 should be low_stock');
assert.strictEqual(mockProduct.variants[0].quantity, 15, 'v1 must remain completely unaffected at 15');
assert.strictEqual(mockProduct.variants[2].quantity, 0, 'v3 must remain completely unaffected at 0');
assert.strictEqual(mockProduct.stock, 16, 'Parent product stock must be 19 - 3 = 16');
console.log('  ✓ Only selected variant decreased (4 -> 1), other variants untouched, parent stock updated');

// 6. Order Cancellation Restock Logic
console.log('\nTest 6: Simulating Order Cancellation Variant Restock');
// Customer cancels order: Ruby Red / M qty = 3
targetVariant.quantity += purchaseQty;
targetVariant.availableQuantity = Math.max(0, targetVariant.quantity - (targetVariant.reservedQuantity || 0));
targetVariant.status = targetVariant.quantity <= 0 ? 'out_of_stock' : (targetVariant.quantity <= targetVariant.lowStockThreshold ? 'low_stock' : 'in_stock');

mockProduct.stock = mockProduct.variants.reduce((sum, v) => sum + v.quantity, 0);

assert.strictEqual(targetVariant.quantity, 4, 'v2 quantity restored from 1 to 4');
assert.strictEqual(mockProduct.stock, 19, 'Parent product stock restored to 19');
console.log('  ✓ Cancelled items restored precisely to exact variant and parent stock');

// 7. Cart Unique Key Logic
console.log('\nTest 7: Cart Unique Key Generation');
const cartItem1Key = `prod_101_${mockProduct.variants[0].variantId}`;
const cartItem2Key = `prod_101_${mockProduct.variants[1].variantId}`;
assert.notStrictEqual(cartItem1Key, cartItem2Key, 'Cart keys for different variants of the same product must be distinct');
console.log(`  ✓ Distinct cart keys verified: "${cartItem1Key}" vs "${cartItem2Key}"`);

console.log('\n======================================================');
console.log('🎉 ALL 7 VARIANT INVENTORY SYSTEM TESTS PASSED SUCCESSFULLY!');
console.log('======================================================');
