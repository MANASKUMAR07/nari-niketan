// =============================================
// NARI NIKETAN — Coupon Controller
// =============================================

'use strict';

const CouponService           = require('../services/couponService');
const PricingService          = require('../services/pricingService');
const { validateCouponSchema } = require('../validators/couponValidator');
const asyncHandler            = require('../utils/asyncHandler');

// POST /api/coupons/validate
// Preview: validate a coupon and return discount info.
// The server ALWAYS recalculates on order creation — this is a UX preview only.
const validateCoupon = asyncHandler(async (req, res) => {
  const { couponCode, subtotal } = validateCouponSchema.parse(req.body);
  const uid = req.user.uid;

  const result = await CouponService.validate(couponCode, subtotal, uid);

  if (!result.valid) {
    return res.status(400).json({
      success: false,
      error:   result.reason || 'Invalid coupon code.',
    });
  }

  // Also calculate what the new total would look like
  const shippingAfterDiscount = PricingService.calculateTotal(
    [],  // no line items needed for shipping preview
    result,
    'delivery'
  ).shippingAmount;

  res.json({
    success:        true,
    valid:          true,
    couponCode:     result.couponCode,
    label:          result.label,
    discountAmount: result.discountAmount,
    freeShipping:   result.freeShipping || false,
    discountType:   result.discountType,
    // Calculated new total is for DISPLAY only — order creation recalculates authoritatively
    message:        `Coupon "${result.couponCode}" applied! ${result.label}`,
  });
});

module.exports = { validateCoupon };
