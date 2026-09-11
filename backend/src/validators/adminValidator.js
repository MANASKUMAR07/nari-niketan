// =============================================
// NARI NIKETAN — Admin Validators (Zod)
// =============================================

'use strict';

const { z } = require('zod');

// Update order status
const updateOrderStatusSchema = z.object({
  status:    z.enum(['Pending', 'Processing', 'Shipped', 'Out for Delivery', 'Delivered',
                     'Cancelled', 'Return Requested', 'Return Approved', 'Returned',
                     'Returned to Store', 'Collected', 'Refunded']),
  adminNote: z.string().max(500).optional(),
  paymentStatus: z.enum([
    'Pending Payment', 'Pending UTR Verification', 'Paid', 'Paid (COD Collected)',
    'Pending (COD)', 'Payment Verified', 'Refunded',
  ]).optional(),
});

// Set user role (admin only)
const setUserRoleSchema = z.object({
  admin:  z.boolean().optional(),
  seller: z.boolean().optional(),
  owner:  z.boolean().optional(),
}).refine(data => Object.keys(data).length > 0, { message: 'Provide at least one role field.' });

// Block/unblock user
const blockUserSchema = z.object({
  blocked: z.boolean(),
  reason:  z.string().max(200).optional(),
});

// Create/update coupon
const upsertCouponSchema = z.object({
  code:        z.string().min(2).max(30).regex(/^[A-Z0-9_-]+$/, 'Code must be uppercase letters, numbers, dashes only'),
  type:        z.enum(['percent', 'flat', 'shipping']),
  discount:    z.number().min(0).max(100000),
  label:       z.string().max(100).optional(),
  active:      z.boolean().optional().default(true),
  minOrder:    z.number().min(0).optional().nullable(),
  maxDiscount: z.number().min(0).optional().nullable(),
  usageLimit:  z.number().int().min(0).optional().nullable(),
  perUserLimit:z.number().int().min(0).optional().nullable(),
  startDate:   z.string().datetime().optional().nullable(),
  expiresAt:   z.string().datetime().optional().nullable(),
});

// Update seller status
const updateSellerStatusSchema = z.object({
  sellerStatus: z.enum(['pending', 'approved', 'rejected', 'suspended']),
  commissionRate: z.number().min(0).max(100).optional(),
});

// Create delivery payout
const createPayoutSchema = z.object({
  partnerId:      z.string().min(1),
  amount:         z.number().positive(),
  notes:          z.string().max(300).optional(),
  transactionRef: z.string().max(100).optional(),
});

module.exports = {
  updateOrderStatusSchema,
  setUserRoleSchema,
  blockUserSchema,
  upsertCouponSchema,
  updateSellerStatusSchema,
  createPayoutSchema,
};
