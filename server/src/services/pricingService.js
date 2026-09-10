// =============================================
// NARI NIKETAN — Pricing Service (Server-Side)
// =============================================
// ALL financial calculations happen here.
// Client-provided prices, subtotals, and totals are IGNORED.

'use strict';

const FREE_SHIPPING_THRESHOLD = parseInt(process.env.FREE_SHIPPING_THRESHOLD || '999', 10);
const SHIPPING_CHARGE         = parseInt(process.env.SHIPPING_CHARGE         || '99',  10);

const PricingService = {
  /**
   * Calculate the authoritative order total from server-fetched product data.
   *
   * @param {Array<{ product: object, requestedQty: number }>} lineItems
   *        product must be the Firestore product document (not client-supplied)
   * @param {object}  couponResult  - Output of CouponService.validate()
   * @param {string}  fulfillmentType - "delivery" | "pickup"
   * @returns {{ subtotal, discountAmount, shippingAmount, grandTotal, tax }}
   */
  calculateTotal(lineItems = [], couponResult = null, fulfillmentType = 'delivery') {
    // ── Subtotal: use the database price, ignore any client-provided price ──
    let subtotal = 0;
    for (const item of lineItems) {
      let unitPrice = 0;
      let qty = 1;

      if (item && item.unitPrice !== undefined) {
        unitPrice = Number(item.unitPrice) || 0;
        qty = Number(item.quantity || item.qty || 1);
      } else if (item && item.product) {
        unitPrice = this.getSellingPrice(item.product);
        qty = Number(item.requestedQty || item.quantity || item.qty || 1);
      } else if (item && item.price !== undefined) {
        unitPrice = Number(item.price) || 0;
        qty = Number(item.quantity || item.qty || 1);
      }

      subtotal += unitPrice * qty;
    }
    subtotal = Math.round(subtotal);

    // ── Coupon discount ──────────────────────────────────────────
    let discountAmount = 0;
    let freeShipping   = false;
    if (couponResult && couponResult.valid) {
      discountAmount = Math.min(couponResult.discountAmount || 0, subtotal);
      freeShipping   = couponResult.freeShipping === true;
    }

    // ── Shipping ─────────────────────────────────────────────────
    let shippingAmount = 0;
    if (fulfillmentType !== 'pickup') {
      if (freeShipping) {
        shippingAmount = 0;
      } else {
        const discountedSubtotal = subtotal - discountAmount;
        shippingAmount = discountedSubtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_CHARGE;
      }
    }

    // ── Tax (not currently charged — placeholder for future) ─────
    const tax = 0;

    const grandTotal = Math.max(0, subtotal - discountAmount + shippingAmount + tax);

    return {
      subtotal,
      discountAmount,
      shippingAmount,
      tax,
      grandTotal,
    };
  },

  /**
   * Get the selling price for a product from the Firestore document.
   * Prefers salePrice (if set and lower than price), falls back to price.
   * NEVER uses a client-supplied price.
   *
   * @param {object} product - Firestore product document
   * @returns {number} unit price in INR
   */
  getSellingPrice(product) {
    if (!product || typeof product !== 'object') return 0;
    const price     = Number(product.price)     || 0;
    const salePrice = Number(product.salePrice) || 0;
    if (salePrice > 0 && salePrice < price) {
      return salePrice;
    }
    return price;
  },
};

module.exports = PricingService;
