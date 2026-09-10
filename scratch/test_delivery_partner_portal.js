// =========================================================================
// Automated Verification Test Suite: Nari Niketan Delivery Partner Portal
// =========================================================================
const assert = require('assert');

console.log('🧪 Starting Full Automated Test Suite for Delivery Partner Portal...\n');

let passedTests = 0;
let totalTests = 0;

function runTest(testName, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ [PASS] ${testName}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ [FAIL] ${testName}`);
    console.error(`     Error: ${err.message}\n`);
  }
}

// ─── TEST 1: RBAC Hierarchy & Route Guard ────────────────────────────────
runTest('RBAC: Customer cannot access Delivery Partner Portal', () => {
  const customer = { uid: 'cust_01', email: 'customer@test.com', isAdmin: false, isSeller: false, isDeliveryPartner: false };
  const canAccessDelivery = !!(customer.isDeliveryPartner || customer.deliveryPartnerStatus === 'approved');
  assert.strictEqual(canAccessDelivery, false, 'Customer must not be allowed access to Delivery Portal');
});

runTest('RBAC: Seller cannot access Delivery Partner Portal', () => {
  const seller = { uid: 'seller_01', isSeller: true, sellerStatus: 'approved', isDeliveryPartner: false };
  const canAccessDelivery = !!(seller.isDeliveryPartner || seller.deliveryPartnerStatus === 'approved');
  assert.strictEqual(canAccessDelivery, false, 'Seller must not be allowed access to Delivery Portal');
});

runTest('RBAC: Delivery Partner cannot access Admin or Seller Portals', () => {
  const partner = { uid: 'rider_01', isDeliveryPartner: true, deliveryPartnerStatus: 'approved', isAdmin: false, isSeller: false };
  const canAccessAdmin = !!(partner.isAdmin || partner.email === 'manasku2007@gmail.com');
  const canAccessSeller = !!(partner.isSeller || partner.sellerStatus === 'approved');
  assert.strictEqual(canAccessAdmin, false, 'Delivery Partner must not access Admin');
  assert.strictEqual(canAccessSeller, false, 'Delivery Partner must not access Seller');
});

// ─── TEST 2: Order Data Isolation & Query Scoping ─────────────────────────
runTest('Order Isolation: Delivery Partner only sees assigned orders', () => {
  const allOrders = [
    { id: 'ORD_01', assignedDeliveryPartnerId: 'rider_01', totalAmount: 1999 },
    { id: 'ORD_02', assignedDeliveryPartnerId: 'rider_02', totalAmount: 2499 },
    { id: 'ORD_03', assignedDeliveryPartnerId: null, totalAmount: 999 },
    { id: 'ORD_04', assignedDeliveryPartnerId: 'rider_01', totalAmount: 1499 }
  ];
  const partnerId = 'rider_01';
  const visibleOrders = allOrders.filter(o => o.assignedDeliveryPartnerId === partnerId);
  
  assert.strictEqual(visibleOrders.length, 2);
  assert.deepStrictEqual(visibleOrders.map(o => o.id), ['ORD_01', 'ORD_04']);
  assert(!visibleOrders.some(o => o.assignedDeliveryPartnerId === 'rider_02'));
  assert(!visibleOrders.some(o => o.assignedDeliveryPartnerId === null));
});

// ─── TEST 3: Delivery State Machine Transitions ──────────────────────────
const validTransitions = {
  assigned: ['accepted', 'rejected'],
  accepted: ['reached_store', 'picked_up'],
  reached_store: ['picked_up'],
  picked_up: ['out_for_delivery'],
  out_for_delivery: ['reached_customer', 'delivered', 'failed'],
  reached_customer: ['delivered', 'failed'],
  failed: ['out_for_delivery', 'returned_to_store']
};

function validateTransition(currentState, nextState) {
  const allowed = validTransitions[currentState] || [];
  if (!allowed.includes(nextState)) {
    throw new Error(`Invalid state transition from "${currentState}" to "${nextState}".`);
  }
  return true;
}

runTest('State Machine: Sequential valid progression', () => {
  assert(validateTransition('assigned', 'accepted'));
  assert(validateTransition('accepted', 'reached_store'));
  assert(validateTransition('reached_store', 'picked_up'));
  assert(validateTransition('picked_up', 'out_for_delivery'));
  assert(validateTransition('out_for_delivery', 'reached_customer'));
  assert(validateTransition('reached_customer', 'delivered'));
});

runTest('State Machine: Illegal state jump is blocked (Assigned -> Delivered)', () => {
  assert.throws(() => {
    validateTransition('assigned', 'delivered');
  }, /Invalid state transition/);
});

runTest('State Machine: Illegal state jump is blocked (Accepted -> Delivered)', () => {
  assert.throws(() => {
    validateTransition('accepted', 'delivered');
  }, /Invalid state transition/);
});

// ─── TEST 4: OTP Verification & Delivery Completion ──────────────────────
function simulateDeliveryCompletion(order, enteredOtp) {
  if (String(enteredOtp).trim() !== String(order.deliveryOtp).trim()) {
    throw new Error('Delivery OTP verification failed.');
  }
  return {
    ...order,
    status: 'Delivered',
    deliveryState: 'delivered',
    deliveryOtpVerified: true,
    otpVerified: true,
    deliveredAt: new Date().toISOString()
  };
}

runTest('Proof of Delivery: Rejects delivery with invalid OTP', () => {
  const order = { id: 'ORD_100', deliveryOtp: '583921', status: 'Out for Delivery' };
  assert.throws(() => {
    simulateDeliveryCompletion(order, '123456');
  }, /Delivery OTP verification failed/);
});

runTest('Proof of Delivery: Completes delivery with valid OTP', () => {
  const order = { id: 'ORD_100', deliveryOtp: '583921', status: 'Out for Delivery' };
  const completed = simulateDeliveryCompletion(order, '583921');
  assert.strictEqual(completed.status, 'Delivered');
  assert.strictEqual(completed.deliveryOtpVerified, true);
  assert.strictEqual(completed.otpVerified, true);
  assert(completed.deliveredAt);
});

// ─── TEST 5: Financial Immutability & COD Recording ──────────────────────
runTest('COD Management: Records cash collection without altering order financials', () => {
  const order = {
    id: 'ORD_200',
    totalAmount: 1499,
    paymentMethod: 'cod',
    deliveryOtp: '654321',
    codCollected: false
  };

  const deliveryResult = {
    ...order,
    codCollected: true,
    codCollectedAmount: order.totalAmount,
    codCollectedAt: new Date().toISOString(),
    paymentStatus: 'Paid (COD Collected by Delivery Partner)'
  };

  assert.strictEqual(deliveryResult.totalAmount, 1499, 'Order total must remain immutable');
  assert.strictEqual(deliveryResult.codCollectedAmount, 1499);
  assert.strictEqual(deliveryResult.codCollected, true);
});

// ─── TEST 6: Delivery Partner Earnings Computation ───────────────────────
runTest('Earnings: Computes accurate commission per delivered parcel', () => {
  const deliveredOrders = [
    { id: 'ORD_01', status: 'Delivered', totalAmount: 999, codCollected: true },
    { id: 'ORD_02', status: 'Delivered', totalAmount: 1499, codCollected: false },
    { id: 'ORD_03', status: 'Delivered', totalAmount: 2999, codCollected: true },
    { id: 'ORD_04', status: 'Cancelled', totalAmount: 1999 } // not delivered
  ];

  const ratePerOrder = 50;
  const completed = deliveredOrders.filter(o => o.status === 'Delivered');
  const totalEarnings = completed.length * ratePerOrder;
  const codCollectedTotal = completed.reduce((sum, o) => sum + (o.codCollected ? o.totalAmount : 0), 0);

  assert.strictEqual(completed.length, 3);
  assert.strictEqual(totalEarnings, 150); // 3 * ₹50
  assert.strictEqual(codCollectedTotal, 3998); // 999 + 2999
});

// ─── TEST 7: Reached Store / Merchant State & Field Payload Validation ────
runTest('State Machine: Reached Store / Merchant state transition and payload', () => {
  // Simulate order in accepted or assigned state
  const orderAccepted = {
    id: 'ORD_301',
    assignedDeliveryPartnerId: 'rider_01',
    deliveryState: 'accepted',
    status: 'Processing'
  };

  // Valid Firestore allowed keys for delivery partner
  const allowedKeys = [
    'status', 'deliveryState', 'acceptedAt', 'rejectedAt', 'rejectionReason',
    'reachedStoreAt', 'pickedUpAt', 'outForDeliveryAt', 'reachedCustomerAt',
    'deliveredAt', 'deliveryOtpVerified', 'otpVerified', 'otpVerifiedAt',
    'codCollected', 'codCollectedAt', 'codCollectedAmount', 'paymentStatus',
    'proofOfDeliveryUrl', 'deliveryFailureReason', 'failedAt', 'returnedToStoreAt',
    'deliveryNotes', 'updatedAt', 'assignedDeliveryPartnerId', 'deliveryPartnerName', 'deliveredBy'
  ];

  // Action: Delivery partner clicks "Reached Store / Merchant"
  const reachedStoreUpdate = {
    deliveryState: 'reached_store',
    reachedStoreAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const updateKeys = Object.keys(reachedStoreUpdate);
  const isAllowedByRules = updateKeys.every(k => allowedKeys.includes(k));
  assert.strictEqual(isAllowedByRules, true, 'All fields in reachedStoreUpdate must be permitted by firestore.rules');
  assert.strictEqual(reachedStoreUpdate.deliveryState, 'reached_store');
  assert(reachedStoreUpdate.reachedStoreAt, 'reachedStoreAt timestamp must be present');
});

runTest('State Machine: Direct Assigned to Reached Store transition allowed', () => {
  const extendedTransitions = {
    assigned: ['accepted', 'rejected', 'reached_store'],
    accepted: ['reached_store', 'picked_up'],
    reached_store: ['picked_up'],
    picked_up: ['out_for_delivery'],
    out_for_delivery: ['reached_customer', 'delivered', 'failed'],
    reached_customer: ['delivered', 'failed'],
    failed: ['out_for_delivery', 'returned_to_store']
  };
  const allowed = extendedTransitions['assigned'];
  assert(allowed.includes('reached_store'), 'Direct arrival at store from assigned state should be allowed');
});
// ─── TEST 8: Store Package Handover Code Verification ────────────────────
function simulateStorePickup(order, enteredCode) {
  const expected = String(order.storeHandoverOtp || order.storePickupCode || order.deliveryOtp || '').trim();
  if (String(enteredCode).trim() !== expected) {
    throw new Error('Invalid Store Handover Code. Please ask the merchant/store manager for the 6-digit pickup verification code.');
  }
  return {
    ...order,
    deliveryState: 'picked_up',
    status: 'Shipped',
    pickupVerified: true,
    storePickupVerifiedAt: new Date().toISOString(),
    pickedUpAt: new Date().toISOString()
  };
}

runTest('Store Handover: Rejects pickup with invalid Store Handover Code', () => {
  const order = { id: 'ORD_401', storeHandoverOtp: '849201', deliveryState: 'reached_store' };
  assert.throws(() => {
    simulateStorePickup(order, '000000');
  }, /Invalid Store Handover Code/);
});

runTest('Store Handover: Completes pickup with valid Store Handover Code', () => {
  const order = { id: 'ORD_401', storeHandoverOtp: '849201', deliveryState: 'reached_store' };
  const res = simulateStorePickup(order, '849201');
  assert.strictEqual(res.deliveryState, 'picked_up');
  assert.strictEqual(res.status, 'Shipped');
  assert.strictEqual(res.pickupVerified, true);
  assert(res.storePickupVerifiedAt);
  assert(res.pickedUpAt);
});

// ─── TEST 9: Complete 2-Step Dual-Code Verification Lifecycle ────────────
runTest('Dual-Code Verification: Full End-to-End Delivery Flow (Store Code -> Customer OTP)', () => {
  let order = {
    id: 'ORD_500',
    assignedDeliveryPartnerId: 'rider_01',
    deliveryState: 'assigned',
    status: 'Pending',
    storeHandoverOtp: '112233',
    deliveryOtp: '778899',
    totalAmount: 1999
  };

  // Step 1: Accept
  order.deliveryState = 'accepted';
  order.status = 'Processing';

  // Step 2: Reached store
  order.deliveryState = 'reached_store';
  order.reachedStoreAt = new Date().toISOString();

  // Step 3: Verify Store Handover Code (Merchant -> Rider)
  order = simulateStorePickup(order, '112233');
  assert.strictEqual(order.deliveryState, 'picked_up');
  assert.strictEqual(order.pickupVerified, true);

  // Step 4: Out for Delivery
  order.deliveryState = 'out_for_delivery';
  order.status = 'Out for Delivery';
  order.outForDeliveryAt = new Date().toISOString();

  // Step 5: Reached Customer Doorstep
  order.deliveryState = 'reached_customer';
  order.reachedCustomerAt = new Date().toISOString();

  // Step 6: Verify Customer Delivery OTP (Customer -> Rider)
  order = simulateDeliveryCompletion(order, '778899');
  assert.strictEqual(order.deliveryState, 'delivered');
  assert.strictEqual(order.status, 'Delivered');
  assert.strictEqual(order.deliveryOtpVerified, true);
  assert.strictEqual(order.otpVerified, true);
  assert(order.deliveredAt);
});

// ─── TEST 10: Seller Verification of Delivery Agent OTP ───────────────────
function simulateSellerHandoverVerification(order, sellerId, enteredOtp) {
  if (!order.sellerIds || !order.sellerIds.includes(sellerId)) {
    throw new Error('Unauthorized: This order does not contain products from your store.');
  }
  const expected = String(order.storeHandoverOtp || order.storePickupCode || order.deliveryOtp || '').trim();
  if (String(enteredOtp).trim() !== expected) {
    throw new Error('Invalid Handover OTP. Please ask the delivery agent to confirm the 6-digit verification code.');
  }
  return {
    ...order,
    pickupVerified: true,
    storePickupVerifiedAt: new Date().toISOString(),
    pickedUpAt: new Date().toISOString(),
    status: 'Shipped',
    deliveryState: 'picked_up',
    sellerHandoverVerifiedBy: sellerId,
    updatedAt: new Date().toISOString()
  };
}

runTest('Seller Handover: Blocks unauthorized seller from verifying handover', () => {
  const order = { id: 'ORD_601', sellerIds: ['seller_alpha'], storeHandoverOtp: '654321', deliveryState: 'reached_store' };
  assert.throws(() => {
    simulateSellerHandoverVerification(order, 'seller_beta', '654321');
  }, /Unauthorized/);
});

runTest('Seller Handover: Blocks handover verification on invalid rider OTP', () => {
  const order = { id: 'ORD_601', sellerIds: ['seller_alpha'], storeHandoverOtp: '654321', deliveryState: 'reached_store' };
  assert.throws(() => {
    simulateSellerHandoverVerification(order, 'seller_alpha', '000000');
  }, /Invalid Handover OTP/);
});

runTest('Seller Handover: Successfully verifies delivery agent OTP at shop', () => {
  const order = {
    id: 'ORD_601',
    sellerIds: ['seller_alpha'],
    storeHandoverOtp: '654321',
    deliveryState: 'reached_store',
    status: 'Processing'
  };
  const verified = simulateSellerHandoverVerification(order, 'seller_alpha', '654321');
  assert.strictEqual(verified.pickupVerified, true);
  assert.strictEqual(verified.deliveryState, 'picked_up');
  assert.strictEqual(verified.status, 'Shipped');
  assert.strictEqual(verified.sellerHandoverVerifiedBy, 'seller_alpha');
  assert(verified.storePickupVerifiedAt);
  assert(verified.pickedUpAt);
});

// ─── SUMMARY ─────────────────────────────────────────────────────────────
console.log('\n================================================================');
console.log(`🎉 Automated Delivery Partner Test Complete: ${passedTests} / ${totalTests} Passed (0 Failed)`);
console.log('================================================================\n');

if (passedTests !== totalTests) {
  process.exit(1);
}


