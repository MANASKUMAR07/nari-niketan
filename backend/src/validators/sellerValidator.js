// =============================================
// NARI NIKETAN — Seller Validators (Zod)
// =============================================

'use strict';

const { z } = require('zod');

// Schema for individual size + color variants
const variantSchema = z.object({
  variantId:          z.string().min(1).max(128),
  sku:                z.string().max(128).optional().nullable(),
  size:               z.string().max(50).optional().default(''),
  color:              z.string().max(50).optional().default(''),
  colorCode:          z.string().max(30).optional().nullable(),
  quantity:           z.number().int().min(0, 'Quantity cannot be negative'),
  reservedQuantity:   z.number().int().min(0).optional().default(0),
  availableQuantity:  z.number().int().min(0).optional(),
  lowStockThreshold:  z.number().int().min(0).optional().default(5),
  price:              z.number().positive().optional().nullable(),
  mrp:                z.number().positive().optional().nullable(),
  active:             z.boolean().optional().default(true),
  status:             z.enum(['in_stock', 'low_stock', 'out_of_stock']).optional(),
  attributes:         z.record(z.any()).optional().default({}),
});

// Schema for shipping specs
const shippingSchema = z.object({
  weight:                z.number().min(0).optional().default(0.5),
  length:                z.number().min(0).optional().default(30),
  width:                 z.number().min(0).optional().default(20),
  height:                z.number().min(0).optional().default(5),
  shippingCategory:      z.string().max(50).optional().default('Standard'),
  storePickupAvailable:  z.boolean().optional().default(true),
  deliveryAvailable:     z.boolean().optional().default(true),
}).optional().nullable();

// Schema for structured pricing
const pricingSchema = z.object({
  mrp:                 z.number().positive('MRP must be positive'),
  sellingPrice:        z.number().positive('Selling price must be positive'),
  discountPercentage:  z.number().min(0).max(100).optional().default(0),
}).optional().nullable();

// Add or update a product
const upsertProductSchema = z.object({
  name:               z.string().min(2).max(200),
  slug:               z.string().max(250).optional().nullable(),
  description:        z.string().max(5000).optional().default(''),
  shortDescription:   z.string().max(500).optional().default(''),
  highlights:         z.array(z.string().max(200)).optional().default([]),
  category:           z.string().min(1).max(100),
  subcategory:        z.string().max(100).optional().nullable(),
  brand:              z.string().max(100).optional().nullable(),
  productType:        z.enum(['single', 'size_only', 'color_only', 'size_color']).optional().default('size_color'),

  // Pricing (root level for backward-compat + nested)
  price:              z.number().positive('Price must be positive'),
  salePrice:          z.number().positive().optional().nullable(),
  originalPrice:      z.number().positive().optional().nullable(),
  discount:           z.number().min(0).max(100).optional().nullable(),
  pricing:            pricingSchema,

  // Aggregated & variant inventory
  stock:              z.number().int().min(0).optional().default(0),
  variants:           z.array(variantSchema).optional().default([]),
  inventory:          z.object({
    totalQuantity:          z.number().int().min(0).optional().default(0),
    totalReservedQuantity:  z.number().int().min(0).optional().default(0),
    totalAvailableQuantity: z.number().int().min(0).optional().default(0),
    lowStockCount:          z.number().int().min(0).optional().default(0),
    outOfStockCount:        z.number().int().min(0).optional().default(0),
    hasVariants:            z.boolean().optional().default(false),
  }).optional().nullable(),

  // Options & attributes
  sizes:              z.array(z.string().max(50)).optional().default([]),
  colors:             z.array(z.string().max(50)).optional().default([]),
  attributes:         z.record(z.any()).optional().default({}),
  shipping:           shippingSchema,

  // Media
  imageUrl:           z.string().url().optional().nullable(),
  thumbnail:          z.string().url().optional().nullable(),
  images:             z.array(z.any()).optional().default([]),
  imageObjects:       z.array(z.any()).optional().default([]),

  // Ethnic specific legacy fields
  fabric:             z.string().max(100).optional().nullable(),
  occasion:           z.string().max(100).optional().nullable(),
  care:               z.string().max(200).optional().nullable(),

  // Status & flags
  sku:                z.string().max(128).optional().nullable(),
  lowStockThreshold:  z.number().int().min(0).optional().default(5),
  featured:           z.boolean().optional().default(false),
  active:             z.boolean().optional().default(true),
  draft:              z.boolean().optional().default(false),
  status:             z.enum(['DRAFT', 'ACTIVE', 'OUT_OF_STOCK', 'HIDDEN', 'ARCHIVED']).optional().default('ACTIVE'),
  tags:               z.array(z.string().max(50)).optional().default([]),
  aiGenerated:        z.any().optional().nullable(),
}).refine(data => {
  if (data.salePrice && data.salePrice > data.price) {
    return false; // sale price cannot exceed MRP
  }
  return true;
}, { message: 'Selling price cannot be greater than MRP.', path: ['salePrice'] });

// Quick inventory update for a specific variant or root product
const quickUpdateInventorySchema = z.object({
  variantId: z.string().max(128).optional().nullable(),
  quantity:  z.number().int().min(0, 'Quantity cannot be negative'),
  reason:    z.enum(['RESTOCK', 'DAMAGE', 'RETURN', 'CORRECTION', 'SELLER_MANUAL_UPDATE', 'ORDER_PLACED', 'ORDER_CANCELLED']).optional().default('SELLER_MANUAL_UPDATE'),
  note:      z.string().max(500).optional().default(''),
});

const updateInventorySchema = z.object({
  stock:     z.number().int().min(0, 'Stock cannot be negative').optional(),
  variantId: z.string().max(128).optional().nullable(),
  quantity:  z.number().int().min(0, 'Quantity cannot be negative').optional(),
  reason:    z.enum(['RESTOCK', 'DAMAGE', 'RETURN', 'CORRECTION', 'SELLER_MANUAL_UPDATE', 'ORDER_PLACED', 'ORDER_CANCELLED']).optional().default('SELLER_MANUAL_UPDATE'),
  note:      z.string().max(500).optional().default(''),
});

module.exports = {
  variantSchema,
  shippingSchema,
  pricingSchema,
  upsertProductSchema,
  quickUpdateInventorySchema,
  updateInventorySchema,
};
