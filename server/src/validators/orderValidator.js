// =============================================
// NARI NIKETAN — Order Request Validator (Zod)
// =============================================

'use strict';

const { z } = require('zod');

const addressSchema = z.object({
  line1:   z.string().min(3).max(200),
  line2:   z.string().max(200).optional().default(''),
  city:    z.string().min(2).max(100),
  state:   z.string().min(2).max(100),
  pincode: z.string().regex(/^\d{6}$/, 'Pincode must be exactly 6 digits'),
  country: z.string().max(50).optional().default('India'),
  // Optional GPS coordinates — must be realistic India-region coords
  latitude:  z.number().min(6).max(38).optional().nullable(),
  longitude: z.number().min(68).max(98).optional().nullable(),
}).optional().nullable();

const orderItemSchema = z.object({
  productId: z.string().min(1).max(128),
  variantId: z.string().max(128).optional().nullable(),
  sku:       z.string().max(128).optional().nullable(),
  quantity:  z.number().int().positive().max(10),
  size:      z.string().max(50).optional().default(''),
  color:     z.string().max(50).optional().default(''),
});

const createOrderSchema = z.object({
  // Cart items — only IDs and intent; prices are FETCHED server-side
  items:           z.array(orderItemSchema).min(1).max(20),

  // Coupon — server validates, server calculates discount
  couponCode:      z.string().max(30).optional().nullable(),

  // Fulfillment
  fulfillmentType: z.enum(['delivery', 'pickup']).default('delivery'),
  shippingAddress: addressSchema,

  // Customer contact
  customerName:    z.string().min(1).max(100),
  phone:           z.string().regex(/^\+?[\d\s\-()]{7,20}$/, 'Invalid phone number'),

  // Payment intent — server determines paymentStatus; this is informational only
  paymentMethod:   z.string().transform(val => {
    if (val && val.toLowerCase().includes('cash')) return 'Cash on Delivery';
    return 'UPI';
  }).default('UPI'),

  // Optional UTR — stored as-is, NOT treated as proof of payment
  upiUtr:          z.string().max(50).optional().nullable(),
}).refine(data => {
  // Delivery orders must have a shipping address
  if (data.fulfillmentType === 'delivery') {
    return !!data.shippingAddress;
  }
  return true;
}, { message: 'Shipping address is required for delivery orders.', path: ['shippingAddress'] });

module.exports = { createOrderSchema };
