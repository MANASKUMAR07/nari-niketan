// =============================================
// NARI NIKETAN — Admin Controller
// =============================================
// All routes here require: authenticateFirebaseUser + requireAdmin
// Role is verified via Firebase Custom Claims — never client-supplied fields.

'use strict';

const admin        = require('firebase-admin');
const { db, auth } = require('../config/firebase');
const asyncHandler = require('../utils/asyncHandler');
const { NotFoundError, ValidationError } = require('../utils/errors');
const logger       = require('../utils/logger');
const {
  updateOrderStatusSchema,
  setUserRoleSchema,
  blockUserSchema,
  upsertCouponSchema,
  updateSellerStatusSchema,
  createPayoutSchema,
} = require('../validators/adminValidator');

// ── ORDERS ───────────────────────────────────────────────────────────────────

// GET /api/admin/orders
const getAllOrders = asyncHandler(async (req, res) => {
  const { status } = req.query;
  let query = db.collection('orders').orderBy('createdAt', 'desc').limit(200);
  if (status && status !== 'all') {
    query = db.collection('orders').where('status', '==', status).limit(200);
  }
  const snap = await query.get();
  const orders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  res.json({ success: true, orders });
});

// PATCH /api/admin/orders/:id/status
const updateOrderStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const data   = updateOrderStatusSchema.parse(req.body);

  const orderRef = db.collection('orders').doc(id);
  const doc      = await orderRef.get();
  if (!doc.exists) throw new NotFoundError('Order');

  const update = {
    status:    data.status,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  if (data.adminNote)     update.adminNote     = data.adminNote;
  if (data.paymentStatus) update.paymentStatus = data.paymentStatus;
  if (data.status === 'Delivered' || data.status === 'Collected') {
    update.deliveredAt = admin.firestore.FieldValue.serverTimestamp();
  }

  await orderRef.update(update);

  logger.audit('ADMIN_UPDATE_ORDER_STATUS', req.user.uid, {
    orderId: id, status: data.status, paymentStatus: data.paymentStatus,
  });

  res.json({ success: true, message: `Order status updated to "${data.status}".` });
});

// ── USERS ────────────────────────────────────────────────────────────────────

// GET /api/admin/users
const getAllUsers = asyncHandler(async (req, res) => {
  const snap = await db.collection('users').get();
  const users = snap.docs.map(d => {
    const u = d.data();
    return {
      id:           d.id,
      name:         u.name,
      email:        u.email,
      phone:        u.phone,
      isAdmin:      u.isAdmin,
      isSeller:     u.isSeller,
      sellerStatus: u.sellerStatus,
      blocked:      u.blocked,
      createdAt:    u.createdAt,
    };
  });
  res.json({ success: true, users });
});

// PATCH /api/admin/users/:uid/role
// Sets Firebase Custom Claims AND syncs the Firestore user doc.
// IMPORTANT: Claims are set server-side — cannot be forged by clients.
const setUserRole = asyncHandler(async (req, res) => {
  const { uid }     = req.params;
  const roleUpdates = setUserRoleSchema.parse(req.body);

  // Fetch current claims first so we don't wipe other claims
  const currentUser    = await auth.getUser(uid);
  const currentClaims  = currentUser.customClaims || {};

  const newClaims = { ...currentClaims };
  if (typeof roleUpdates.admin  === 'boolean') newClaims.admin  = roleUpdates.admin;
  if (typeof roleUpdates.seller === 'boolean') newClaims.seller = roleUpdates.seller;
  // owner can only be set by another owner (enforced at route level via requireOwner)
  if (typeof roleUpdates.owner  === 'boolean') newClaims.owner  = roleUpdates.owner;

  // Set Firebase Custom Claims (server-side — cannot be forged)
  await auth.setCustomUserClaims(uid, newClaims);

  // Sync Firestore user doc for UI display and legacy Firestore rules
  const firestoreUpdate = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
  if (typeof roleUpdates.admin  === 'boolean') firestoreUpdate.isAdmin  = roleUpdates.admin;
  if (typeof roleUpdates.seller === 'boolean') {
    firestoreUpdate.isSeller     = roleUpdates.seller;
    firestoreUpdate.sellerStatus = roleUpdates.seller ? 'approved' : 'revoked';
  }
  await db.collection('users').doc(uid).update(firestoreUpdate);

  logger.audit('ADMIN_SET_USER_ROLE', req.user.uid, { targetUid: uid, claims: newClaims });

  res.json({
    success: true,
    message: `User roles updated. User must sign out and sign back in for the new claims to take effect.`,
    claims:  newClaims,
  });
});

// PATCH /api/admin/users/:uid/block
const blockUser = asyncHandler(async (req, res) => {
  const { uid }  = req.params;
  const { blocked, reason } = blockUserSchema.parse(req.body);

  // Disable/enable in Firebase Auth
  await auth.updateUser(uid, { disabled: blocked });

  await db.collection('users').doc(uid).update({
    blocked,
    blockedReason: reason || null,
    blockedAt:     blocked ? admin.firestore.FieldValue.serverTimestamp() : null,
    updatedAt:     admin.firestore.FieldValue.serverTimestamp(),
  });

  logger.audit(blocked ? 'ADMIN_BLOCK_USER' : 'ADMIN_UNBLOCK_USER', req.user.uid, { targetUid: uid, reason });

  res.json({ success: true, message: `User ${blocked ? 'blocked' : 'unblocked'} successfully.` });
});

// DELETE /api/admin/users/:uid
const deleteUser = asyncHandler(async (req, res) => {
  const { uid } = req.params;
  await db.collection('users').doc(uid).delete();
  // Note: Firebase Auth account is NOT deleted by default — admin must do that separately
  logger.audit('ADMIN_DELETE_USER_DOC', req.user.uid, { targetUid: uid });
  res.json({ success: true, message: 'User profile deleted from Firestore.' });
});

// ── COUPONS ──────────────────────────────────────────────────────────────────

// GET /api/admin/coupons
const getAllCoupons = asyncHandler(async (req, res) => {
  const snap = await db.collection('coupons').get();
  const coupons = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  res.json({ success: true, coupons });
});

// POST /api/admin/coupons
const createCoupon = asyncHandler(async (req, res) => {
  const data = upsertCouponSchema.parse(req.body);
  data.code  = data.code.toUpperCase().trim();

  // Check for duplicate code
  const existing = await db.collection('coupons').where('code', '==', data.code).limit(1).get();
  if (!existing.empty) throw new ValidationError(`Coupon code "${data.code}" already exists.`);

  const ref = await db.collection('coupons').add({
    ...data,
    usedCount:  0,
    createdAt:  admin.firestore.FieldValue.serverTimestamp(),
    createdBy:  req.user.uid,
  });

  logger.audit('ADMIN_CREATE_COUPON', req.user.uid, { couponId: ref.id, code: data.code });
  res.status(201).json({ success: true, couponId: ref.id, code: data.code });
});

// PATCH /api/admin/coupons/:id
const updateCoupon = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const data   = upsertCouponSchema.partial().parse(req.body);
  if (data.code) data.code = data.code.toUpperCase().trim();

  await db.collection('coupons').doc(id).update({
    ...data,
    updatedAt:  admin.firestore.FieldValue.serverTimestamp(),
    updatedBy:  req.user.uid,
  });

  logger.audit('ADMIN_UPDATE_COUPON', req.user.uid, { couponId: id });
  res.json({ success: true, message: 'Coupon updated.' });
});

// DELETE /api/admin/coupons/:id
const deleteCoupon = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await db.collection('coupons').doc(id).delete();
  logger.audit('ADMIN_DELETE_COUPON', req.user.uid, { couponId: id });
  res.json({ success: true, message: 'Coupon deleted.' });
});

// ── SELLERS ──────────────────────────────────────────────────────────────────

// PATCH /api/admin/sellers/:uid/status
const updateSellerStatus = asyncHandler(async (req, res) => {
  const { uid }   = req.params;
  const { sellerStatus, commissionRate } = updateSellerStatusSchema.parse(req.body);

  const isApproved = sellerStatus === 'approved';

  // Set Custom Claim
  const existingUser   = await auth.getUser(uid);
  const existingClaims = existingUser.customClaims || {};
  await auth.setCustomUserClaims(uid, { ...existingClaims, seller: isApproved });

  // Update Firestore
  const update = {
    sellerStatus,
    isSeller:           isApproved,
    sellerStatusUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt:          admin.firestore.FieldValue.serverTimestamp(),
  };
  if (commissionRate !== undefined) {
    update['deliveryProfile.commissionPerOrder'] = Number(commissionRate);
  }

  await db.collection('users').doc(uid).update(update);

  logger.audit('ADMIN_UPDATE_SELLER_STATUS', req.user.uid, { targetUid: uid, sellerStatus });
  res.json({ success: true, message: `Seller status updated to "${sellerStatus}".` });
});

// ── PAYMENTS ─────────────────────────────────────────────────────────────────

// PATCH /api/admin/orders/:id/verify-payment
// Admin manually verifies a UTR and marks the order as Paid.
const verifyPayment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { z }  = require('zod');
  const schema = z.object({ note: z.string().max(200).optional() });
  const { note } = schema.parse(req.body);

  const orderRef = db.collection('orders').doc(id);
  const doc = await orderRef.get();
  if (!doc.exists) throw new NotFoundError('Order');

  await orderRef.update({
    paymentStatus:      'Payment Verified',
    paymentVerifiedAt:  admin.firestore.FieldValue.serverTimestamp(),
    paymentVerifiedBy:  req.user.uid,
    paymentNote:        note || '',
    updatedAt:          admin.firestore.FieldValue.serverTimestamp(),
  });

  logger.audit('ADMIN_VERIFY_PAYMENT', req.user.uid, { orderId: id });
  res.json({ success: true, message: 'Payment marked as verified.' });
});

// ── STATS ────────────────────────────────────────────────────────────────────

// GET /api/admin/stats
const getStats = asyncHandler(async (req, res) => {
  const [prodSnap, orderSnap, userSnap] = await Promise.all([
    db.collection('products').get(),
    db.collection('orders').get(),
    db.collection('users').get(),
  ]);

  const orders       = orderSnap.docs.map(d => d.data());
  const totalRevenue = orders
    .filter(o => o.paymentStatus === 'Payment Verified' || o.paymentStatus === 'Paid')
    .reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);

  res.json({
    success: true,
    stats: {
      products:  prodSnap.size,
      orders:    orderSnap.size,
      users:     userSnap.size,
      revenue:   totalRevenue,
      pending:   orders.filter(o => o.status === 'Pending').length,
    },
  });
});

// ── DELIVERY PAYOUT ─────────────────────────────────────────────────────────

// POST /api/admin/payouts
const createDeliveryPayout = asyncHandler(async (req, res) => {
  const { partnerId, amount, notes, transactionRef } = createPayoutSchema.parse(req.body);

  const ref = await db.collection('deliveryPayouts').add({
    deliveryPartnerId: partnerId,
    amount:            Number(amount),
    notes:             notes || 'Delivery Partner Payout',
    transactionRef:    transactionRef || '',
    status:            'Processed',
    processedBy:       req.user.uid,
    createdAt:         admin.firestore.FieldValue.serverTimestamp(),
  });

  logger.audit('ADMIN_CREATE_PAYOUT', req.user.uid, { payoutId: ref.id, partnerId, amount });
  res.status(201).json({ success: true, payoutId: ref.id });
});

module.exports = {
  getAllOrders,
  updateOrderStatus,
  getAllUsers,
  setUserRole,
  blockUser,
  deleteUser,
  getAllCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  updateSellerStatus,
  verifyPayment,
  getStats,
  createDeliveryPayout,
};
