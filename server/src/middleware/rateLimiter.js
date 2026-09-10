// =============================================
// NARI NIKETAN — Rate Limiters
// =============================================

'use strict';

const rateLimit = require('express-rate-limit');

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

// Standard API limiter — 100 requests per 15 minutes
const standardLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max:      100,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { success: false, error: 'Too many requests. Please try again later.' },
});

// Strict limiter for order creation — prevent spam/flood
const orderLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max:      10,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { success: false, error: 'Too many order requests. Please slow down.' },
});

// Coupon validation — prevent brute-forcing coupon codes
const couponLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max:      20,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { success: false, error: 'Too many coupon attempts. Please try again later.' },
});

// Payment submission — very strict
const paymentLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max:      5,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { success: false, error: 'Too many payment submissions. Please wait before trying again.' },
});

// Auth / login helper endpoints
const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max:      20,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { success: false, error: 'Too many authentication requests.' },
});

module.exports = {
  standardLimiter,
  orderLimiter,
  couponLimiter,
  paymentLimiter,
  authLimiter,
};
