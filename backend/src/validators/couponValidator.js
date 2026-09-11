// =============================================
// NARI NIKETAN — Coupon Validator (Zod)
// =============================================

'use strict';

const { z } = require('zod');

const validateCouponSchema = z.object({
  couponCode: z.string().min(1).max(30),
  subtotal:   z.number().positive('Subtotal must be positive'),
});

module.exports = { validateCouponSchema };
