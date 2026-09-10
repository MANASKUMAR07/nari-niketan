// =============================================
// NARI NIKETAN — Order Controller
// =============================================

'use strict';

const { db }               = require('../config/firebase');
const OrderService         = require('../services/orderService');
const { createOrderSchema } = require('../validators/orderValidator');
const asyncHandler         = require('../utils/asyncHandler');
const { NotFoundError, AuthorizationError } = require('../utils/errors');
const logger               = require('../utils/logger');

// POST /api/orders
// Creates an order — all financial values calculated server-side.
const createOrder = asyncHandler(async (req, res) => {
  // Validate request body — throws ZodError on failure → caught by errorHandler
  const data = createOrderSchema.parse(req.body);

  // req.user.uid comes from the verified Firebase token — never from req.body
  const result = await OrderService.createOrder({
    uid:             req.user.uid,
    email:           req.user.email,
    items:           data.items,
    couponCode:      data.couponCode,
    shippingAddress: data.shippingAddress,
    fulfillmentType: data.fulfillmentType,
    paymentMethod:   data.paymentMethod,
    customerName:    data.customerName,
    phone:           data.phone,
    upiUtr:          data.upiUtr,
  });

  res.status(201).json({ success: true, order: result });
});

// GET /api/orders/my
// Returns the authenticated user's own orders only.
const getMyOrders = asyncHandler(async (req, res) => {
  const uid = req.user.uid;

  const snap = await db.collection('orders')
    .where('userId', '==', uid)
    .get();

  const orders = snap.docs.map(d => sanitiseOrderForCustomer(d.id, d.data()));

  orders.sort((a, b) => {
    const ms = x => x.createdAtMs || 0;
    return ms(b) - ms(a);
  });

  res.json({ success: true, orders });
});

// GET /api/orders/:id
// Returns a single order. Customers can only see their own. Admin sees all.
const getOrder = asyncHandler(async (req, res) => {
  const { id }   = req.params;
  const uid      = req.user.uid;
  const claims   = req.user.claims;
  const isAdmin  = claims.admin === true || claims.owner === true;

  const doc = await db.collection('orders').doc(id).get();
  if (!doc.exists) throw new NotFoundError('Order');

  const data = doc.data();

  // Customer may only read their own order
  if (!isAdmin && data.userId !== uid) {
    // Check if the user is a seller with items from their store
    const isSeller = claims.seller === true;
    if (isSeller && Array.isArray(data.sellerIds) && data.sellerIds.includes(uid)) {
      return res.json({ success: true, order: sanitiseOrderForSeller(doc.id, data, uid) });
    }
    throw new AuthorizationError('You do not have access to this order.');
  }

  const order = isAdmin
    ? sanitiseOrderForAdmin(doc.id, data)
    : sanitiseOrderForCustomer(doc.id, data);

  res.json({ success: true, order });
});

// POST /api/orders/:id/cancel
// Cancels an order and atomically restores variant stock via Firestore transaction.
const cancelOrder = asyncHandler(async (req, res) => {
  const { id }     = req.params;
  const uid        = req.user.uid;
  const claims     = req.user.claims || {};
  const isAdmin    = claims.admin === true || claims.owner === true;
  const reason     = req.body.reason || 'Cancelled by customer';

  const result = await OrderService.cancelOrder(id, uid, isAdmin, reason);
  res.json({ success: true, message: 'Order cancelled and variant inventory restored.', order: result });
});

// ── Helpers: strip internal / sensitive fields before sending to client ────────

function sanitiseOrderForCustomer(id, data) {
  return {
    id,
    status:          data.status,
    paymentStatus:   data.paymentStatus,
    paymentMethod:   data.paymentMethod,
    items:           (data.items || []).map(i => ({
      productId: i.productId,
      variantId: i.variantId || null,
      sku:       i.sku || null,
      name:      i.name,
      size:      i.size,
      color:     i.color,
      qty:       i.qty,
      price:     i.price,
      imageUrl:  i.imageUrl,
    })),
    subtotal:        data.subtotal,
    discountAmount:  data.discountAmount,
    shipping:        data.shipping,
    totalAmount:     data.totalAmount,
    couponApplied:   data.couponApplied,
    fulfillmentType: data.fulfillmentType,
    deliveryAddress: data.deliveryAddress,
    customerName:    data.customerName,
    createdAt:       data.createdAt,
    createdAtMs:     data.createdAt?.toMillis?.() || 0,
    deliveryOtp:     data.deliveryOtp, // customer needs this
    otpVerified:     data.otpVerified,
    // NEVER expose: deliveryOtp would reveal it, but customer needs it to collect order
    // DO NOT expose: couponId, upiUtr, sellerId internal fields
  };
}

function sanitiseOrderForSeller(id, data, sellerUid) {
  // Sellers only see their own line items
  const myItems = (data.items || []).filter(i => i.sellerId === sellerUid);
  return {
    id,
    status:          data.status,
    paymentStatus:   data.paymentStatus,
    items:           myItems.map(i => ({
      productId: i.productId,
      variantId: i.variantId || null,
      sku:       i.sku || null,
      name:      i.name,
      size:      i.size,
      color:     i.color,
      qty:       i.qty,
      price:     i.price,
      imageUrl:  i.imageUrl,
    })),
    totalAmount:     data.totalAmount,
    customerName:    data.customerName,
    phone:           data.phone,
    deliveryAddress: data.deliveryAddress,
    fulfillmentType: data.fulfillmentType,
    createdAt:       data.createdAt,
    createdAtMs:     data.createdAt?.toMillis?.() || 0,
  };
}

function sanitiseOrderForAdmin(id, data) {
  // Admin gets full order data
  return { id, ...data, createdAtMs: data.createdAt?.toMillis?.() || 0 };
}

module.exports = { createOrder, getMyOrders, getOrder, cancelOrder };
