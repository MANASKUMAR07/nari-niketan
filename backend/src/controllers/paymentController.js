// =============================================
// NARI NIKETAN — Payment Controller
// =============================================
// Manual UPI flow: customer submits a UTR reference after paying.
// The backend NEVER automatically marks an order as Paid.
// Only an admin can update payment status to "Paid" after manual verification.

'use strict';

const admin        = require('firebase-admin');
const { db }       = require('../config/firebase');
const asyncHandler = require('../utils/asyncHandler');
const { ValidationError, NotFoundError, AuthorizationError } = require('../utils/errors');
const logger       = require('../utils/logger');
const { z }        = require('zod');

const submitUtrSchema = z.object({
  orderId:    z.string().min(1).max(128),
  upiUtr:     z.string().min(6).max(50).regex(/^[\w\-]+$/, 'Invalid UTR format'),
  screenshot: z.string().url().optional().nullable(), // optional screenshot URL (Storage)
});

// POST /api/payments/submit-utr
// Customer submits their UPI transaction reference after paying.
// Status is set to "Pending UTR Verification" — NEVER automatically to "Paid".
const submitUtr = asyncHandler(async (req, res) => {
  const { orderId, upiUtr, screenshot } = submitUtrSchema.parse(req.body);
  const uid = req.user.uid;

  // Verify order exists and belongs to the authenticated user
  const orderRef = db.collection('orders').doc(orderId);
  const orderDoc = await orderRef.get();

  if (!orderDoc.exists) throw new NotFoundError('Order');

  const order = orderDoc.data();

  if (order.userId !== uid) {
    logger.authzFailure(uid, `payment/submit-utr/${orderId}`, 'NOT_ORDER_OWNER');
    throw new AuthorizationError('You can only submit payment for your own orders.');
  }

  // Only accept UTR for non-COD, non-already-paid orders
  if (order.paymentMethod === 'Cash on Delivery') {
    throw new ValidationError('UTR submission is not applicable for Cash on Delivery orders.');
  }
  if (order.paymentStatus === 'Paid' || order.paymentStatus === 'Payment Verified') {
    throw new ValidationError('Payment for this order has already been verified.');
  }

  // Validate UTR is not already used for another order
  const existingUtr = await db.collection('orders')
    .where('upiUtr', '==', upiUtr)
    .limit(2)
    .get();

  if (!existingUtr.empty) {
    const otherOrder = existingUtr.docs.find(d => d.id !== orderId);
    if (otherOrder) {
      logger.warn({ type: 'DUPLICATE_UTR', uid, upiUtr, orderId });
      throw new ValidationError('This UTR has already been used for another order. Please check your transaction reference.');
    }
  }

  // Update order — status remains "Pending UTR Verification" for admin review
  await orderRef.update({
    upiUtr,
    paymentStatus:    'Pending UTR Verification',
    utrSubmittedAt:   admin.firestore.FieldValue.serverTimestamp(),
    utrScreenshotUrl: screenshot || null,
    updatedAt:        admin.firestore.FieldValue.serverTimestamp(),
  });

  logger.audit('UTR_SUBMITTED', uid, { orderId, upiUtr: upiUtr.substring(0, 6) + '...' });

  res.json({
    success: true,
    message: 'Payment reference submitted successfully. Your order will be confirmed after admin verification.',
    paymentStatus: 'Pending UTR Verification',
  });
});

// GET /api/payments/status/:orderId
// Returns payment status of the authenticated user's order.
const getPaymentStatus = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const uid = req.user.uid;

  const doc = await db.collection('orders').doc(orderId).get();
  if (!doc.exists) throw new NotFoundError('Order');

  const data = doc.data();
  if (data.userId !== uid) throw new AuthorizationError();

  res.json({
    success:       true,
    orderId,
    paymentStatus: data.paymentStatus,
    paymentMethod: data.paymentMethod,
    totalAmount:   data.totalAmount,
  });
});

module.exports = { submitUtr, getPaymentStatus };
