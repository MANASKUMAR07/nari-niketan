// =============================================
// NARI NIKETAN — Coupon Service (Server-Side)
// =============================================
// ALL coupon validation and discount calculation happens here.
// The browser NEVER determines discount values.

'use strict';

const { db }            = require('../config/firebase');
const { ValidationError } = require('../utils/errors');
const logger            = require('../utils/logger');

const CouponService = {
  /**
   * Validate a coupon code and calculate the applicable discount.
   *
   * @param {string}   code        - Coupon code string (case-insensitive)
   * @param {number}   subtotal    - Server-calculated subtotal in INR (before discount)
   * @param {string}   userId      - Authenticated user's UID
   * @returns {Promise<{ valid: boolean, discountAmount: number, discountType: string, couponId: string, reason?: string }>}
   */
  async validate(code, subtotal, userId) {
    if (!code || typeof code !== 'string') {
      return { valid: false, discountAmount: 0, reason: 'No coupon code provided.' };
    }

    const normalised = code.trim().toUpperCase();
    if (normalised.length > 30) {
      return { valid: false, discountAmount: 0, reason: 'Invalid coupon code.' };
    }

    // Fetch coupon from Firestore — single source of truth
    let coupon = null;
    try {
      const snap = await db.collection('coupons')
        .where('code', '==', normalised)
        .limit(2)
        .get();

      if (snap.empty) {
        return { valid: false, discountAmount: 0, reason: 'Coupon code not found.' };
      }

      // Use the first active doc
      const activeDoc = snap.docs.find(d => d.data().active !== false);
      if (!activeDoc) {
        return { valid: false, discountAmount: 0, reason: 'This coupon is no longer active.' };
      }

      coupon = { id: activeDoc.id, ...activeDoc.data() };
    } catch (err) {
      logger.error('CouponService.validate Firestore error:', err);
      throw new ValidationError('Unable to validate coupon. Please try again.');
    }

    const now = new Date();

    // ── Start date check ─────────────────────────────────────────
    if (coupon.startDate) {
      const start = coupon.startDate.toDate ? coupon.startDate.toDate() : new Date(coupon.startDate);
      if (now < start) {
        return { valid: false, discountAmount: 0, reason: 'This coupon is not yet active.' };
      }
    }

    // ── Expiry check ──────────────────────────────────────────────
    if (coupon.expiresAt) {
      const expiry = coupon.expiresAt.toDate ? coupon.expiresAt.toDate() : new Date(coupon.expiresAt);
      if (now > expiry) {
        return { valid: false, discountAmount: 0, reason: 'This coupon has expired.' };
      }
    }
    if (coupon.endDate) {
      const end = coupon.endDate.toDate ? coupon.endDate.toDate() : new Date(coupon.endDate);
      if (now > end) {
        return { valid: false, discountAmount: 0, reason: 'This coupon has expired.' };
      }
    }

    // ── Global usage limit ────────────────────────────────────────
    if (typeof coupon.usageLimit === 'number' && coupon.usageLimit > 0) {
      const used = typeof coupon.usedCount === 'number' ? coupon.usedCount : 0;
      if (used >= coupon.usageLimit) {
        return { valid: false, discountAmount: 0, reason: 'This coupon has reached its usage limit.' };
      }
    }

    // ── Per-user usage limit ──────────────────────────────────────
    if (typeof coupon.perUserLimit === 'number' && coupon.perUserLimit > 0 && userId) {
      try {
        const usageSnap = await db.collection('couponUsage')
          .where('couponId', '==', coupon.id)
          .where('userId', '==', userId)
          .get();
        if (usageSnap.size >= coupon.perUserLimit) {
          return { valid: false, discountAmount: 0, reason: 'You have already used this coupon the maximum number of times.' };
        }
      } catch (e) {
        logger.warn('CouponService perUserLimit check failed (non-fatal):', e.message);
        // Non-fatal: if we can't check, continue (usage will be recorded on order creation)
      }
    }

    // ── Minimum order amount check ────────────────────────────────
    if (typeof coupon.minOrder === 'number' && coupon.minOrder > 0) {
      if (subtotal < coupon.minOrder) {
        return {
          valid: false,
          discountAmount: 0,
          reason: `Minimum order amount for this coupon is ₹${coupon.minOrder.toLocaleString('en-IN')}.`,
        };
      }
    }

    // ── Calculate discount ────────────────────────────────────────
    let discountAmount = 0;

    if (coupon.type === 'percent') {
      const pct = Math.min(Math.max(Number(coupon.discount) || 0, 0), 100);
      discountAmount = Math.round(subtotal * (pct / 100));

      // Cap at maxDiscount if set
      if (typeof coupon.maxDiscount === 'number' && coupon.maxDiscount > 0) {
        discountAmount = Math.min(discountAmount, coupon.maxDiscount);
      }
    } else if (coupon.type === 'flat') {
      discountAmount = Math.min(subtotal, Math.max(Number(coupon.discount) || 0, 0));
    } else if (coupon.type === 'shipping') {
      // Handled by pricingService — return a flag
      return {
        valid:          true,
        discountAmount: 0,
        freeShipping:   true,
        discountType:   'shipping',
        couponId:       coupon.id,
        couponCode:     coupon.code,
        label:          coupon.label || 'Free Shipping',
      };
    } else {
      return { valid: false, discountAmount: 0, reason: 'Unknown coupon type.' };
    }

    discountAmount = Math.max(0, discountAmount);

    return {
      valid:          true,
      discountAmount,
      freeShipping:   false,
      discountType:   coupon.type,
      couponId:       coupon.id,
      couponCode:     coupon.code,
      label:          coupon.label || `${coupon.discount}${coupon.type === 'percent' ? '%' : '₹'} OFF`,
    };
  },

  /**
   * Increment the usage counters for a coupon after a successful order.
   * Called inside a Firestore batch/transaction from orderService.
   */
  async recordUsage(batch, couponId, userId) {
    const admin = require('firebase-admin');
    const couponRef = db.collection('coupons').doc(couponId);
    batch.update(couponRef, {
      usedCount: admin.firestore.FieldValue.increment(1),
    });

    // Record per-user usage
    const usageRef = db.collection('couponUsage').add({
      couponId,
      userId,
      usedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return usageRef;
  },
};

module.exports = CouponService;
