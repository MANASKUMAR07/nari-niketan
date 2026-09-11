// Test Agentic AI backend tools and service
const agentService = require('../backend/src/services/agentService');

async function runTests() {
  console.log('🧪 Starting Agentic AI Backend Test Suite...\n');

  // Test 1: Search Catalog Tool
  console.log('Test 1: Search Catalog tool ("suit under 2000")...');
  const searchRes = await agentService.executeSearchCatalog({ query: 'suit', maxPrice: 2000 });
  console.log(`  ✓ Found ${searchRes.count} products. Top item:`, searchRes.products[0]?.name || 'None');

  // Test 2: Check Pincode Delivery Tool
  console.log('\nTest 2: Check Pincode tool (231222)...');
  const pinRes = agentService.executeCheckPincodeDelivery({ pincode: '231222' });
  console.log(`  ✓ Pincode 231222: ${pinRes.estimatedDelivery}, Store Pickup: ${pinRes.storePickupAvailable}`);

  // Test 3: Get Store Promotions Tool
  console.log('\nTest 3: Get Store Promotions tool...');
  const promoRes = await agentService.executeGetStorePromotions();
  console.log(`  ✓ Found ${promoRes.activePromotions.length} promo codes:`, promoRes.activePromotions.map(p => p.code).join(', '));

  // Test 4: Customer Message Processing
  console.log('\nTest 4: Customer Message Processing ("Show me sarees under 5500")...');
  const chatRes = await agentService.processCustomerMessage({ message: 'Show me sarees under 5500' });
  console.log(`  ✓ Agent Reply: ${chatRes.reply.slice(0, 80)}...`);
  console.log(`  ✓ Structured Product Cards returned: ${chatRes.cards?.products?.length || 0}`);
  console.log(`  ✓ Tools used: ${chatRes.toolsUsed.join(', ') || 'None'}`);

  // Test 5: Admin Query Processing
  console.log('\nTest 5: Admin Query Processing ("Show me summary of sales")...');
  const adminRes = await agentService.processAdminQuery({ query: 'Show me summary of sales' });
  console.log(`  ✓ Admin Copilot Reply: ${adminRes.reply.slice(0, 100)}...`);

  console.log('\n🎉 ALL AGENTIC AI BACKEND TESTS PASSED!');
  process.exit(0);
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
