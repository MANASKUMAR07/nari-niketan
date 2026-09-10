// =============================================
// NARI NIKETAN — Order Service (Server-Side)
// =============================================
// Transactional, variant-based order creation and inventory deduction pipeline.
//
// Flow:
//   1. Validate request schema & safeguards
//   2. Run Firestore transaction to:
//      a. Read all products
//      b. Check & deduct variant-level stock atomically
//      c. Recompute aggregated product inventory & status
//      d. Verify coupon via CouponService
//      e. Calculate totals via PricingService
//      f. Write order document with variant snapshots
//      g. Write inventory audit logs (ORDER_PLACED)
//   3. Non-blocking post-order updates (stats, coupon usage, audit)
//   4. Return sanitised order summary

'use strict';

const admin          = require('firebase-admin');
const { db }         = require('../config/firebase');
const CouponService  = require('./couponService');
const PricingService = require('./pricingService');
const { ValidationError, NotFoundError, AuthorizationError } = require('../utils/errors');
const logger         = require('../utils/logger');

const MAX_ITEMS_PER_ORDER = parseInt(process.env.MAX_ITEMS_PER_ORDER || '20', 10);
const MAX_QTY_PER_ITEM    = parseInt(process.env.MAX_QTY_PER_ITEM    || '10', 10);

/**
 * Normalizes color and size to generate consistent variant comparison keys.
 */
function normalizeVariantKey(color = '', size = '') {
  const c = String(color || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const s = String(size || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  return `${c || 'default'}__${s || 'default'}`;
}

/**
 * Matches a variant in a product by variantId or (color + size).
 */
function findMatchingVariant(product, requestedVariantId, requestedSize, requestedColor) {
  if (!Array.isArray(product.variants) || product.variants.length === 0) {
    return null;
  }
  // 1. Match by variantId if provided
  if (requestedVariantId) {
    const found = product.variants.find(v => v.variantId === requestedVariantId);
    if (found) return found;
  }
  // 2. Match by normalized color + size
  const targetKey = normalizeVariantKey(requestedColor, requestedSize);
  const foundByKey = product.variants.find(v => {
    if (v.variantId && v.variantId.toLowerCase() === targetKey) return true;
    return normalizeVariantKey(v.color, v.size) === targetKey;
  });
  if (foundByKey) return foundByKey;

  // 3. Match by exact size and color strings
  const reqSizeClean = String(requestedSize || '').trim().toLowerCase();
  const reqColorClean = String(requestedColor || '').trim().toLowerCase();
  const foundExact = product.variants.find(v =>
    String(v.size || '').trim().toLowerCase() === reqSizeClean &&
    String(v.color || '').trim().toLowerCase() === reqColorClean
  );
  if (foundExact) return foundExact;

  // 4. If product has only 1 variant, fallback
  if (product.variants.length === 1) {
    return product.variants[0];
  }

  return null;
}

const OrderService = {
  /**
   * Create a new order with atomic variant stock verification & deduction.
   */
  async createOrder(params) {
    const {
      uid,
      email,
      items,
      couponCode,
      shippingAddress,
      fulfillmentType,
      paymentMethod,
      customerName,
      phone,
      upiUtr,
    } = params;

    // ── 1. Basic quantity safeguards ──────────────────────────────
    if (!Array.isArray(items) || items.length === 0) {
      throw new ValidationError('Order must contain at least one item.');
    }
    if (items.length > MAX_ITEMS_PER_ORDER) {
      throw new ValidationError(`Order cannot contain more than ${MAX_ITEMS_PER_ORDER} different items.`);
    }
    for (const item of items) {
      const qty = Number(item.quantity);
      if (!Number.isInteger(qty) || qty <= 0) {
        throw new ValidationError('Item quantity must be a positive integer.');
      }
      if (qty > MAX_QTY_PER_ITEM) {
        throw new ValidationError(`Maximum ${MAX_QTY_PER_ITEM} units per item allowed.`);
      }
    }

    // ── 2. Run Firestore transaction for atomic inventory & order creation ──
    const transactionResult = await db.runTransaction(async (transaction) => {
      const productIds = [...new Set(items.map(i => i.productId))];
      const productDocs = await Promise.all(
        productIds.map(id => transaction.get(db.collection('products').doc(id)))
      );

      const productMap = {};
      for (let i = 0; i < productIds.length; i++) {
        const doc = productDocs[i];
        if (!doc.exists) {
          throw new NotFoundError(`Product "${productIds[i]}"`);
        }
        const data = doc.data();
        if (data.active === false) {
          throw new ValidationError(`Product "${data.name || productIds[i]}" is no longer available.`);
        }
        productMap[productIds[i]] = {
          ref: doc.ref,
          data: { id: doc.id, ...data }
        };
      }

      // Build verified line items and process inventory changes
      const lineItems = [];
      const auditEntries = [];

      for (const item of items) {
        const pObj = productMap[item.productId];
        const product = pObj.data;
        const requestedQty = Number(item.quantity);

        let unitPrice = PricingService.getSellingPrice(product);
        let selectedVariantId = item.variantId || null;
        let selectedSku = item.sku || product.sku || null;

        // Check if product has variant-based inventory
        if (Array.isArray(product.variants) && product.variants.length > 0) {
          const variant = findMatchingVariant(product, item.variantId, item.size, item.color);
          if (!variant) {
            const desc = [item.color, item.size].filter(Boolean).join(' / ') || 'requested option';
            throw new ValidationError(
              `Variant "${desc}" is not available for "${product.name}".`
            );
          }

          selectedVariantId = variant.variantId;
          selectedSku = variant.sku || product.sku || null;

          if (variant.price && typeof variant.price === 'number') {
            unitPrice = variant.price;
          }

          const availableQty = (variant.quantity || 0) - (variant.reservedQuantity || 0);
          if (requestedQty > availableQty) {
            const varLabel = [variant.color, variant.size].filter(Boolean).join(' / ') || 'Selected variant';
            throw new ValidationError(
              `Only ${Math.max(0, availableQty)} unit(s) of "${product.name}" (${varLabel}) are available. You requested ${requestedQty}.`
            );
          }

          // Atomic deduction from the exact variant
          const prevQty = variant.quantity || 0;
          variant.quantity = Math.max(0, prevQty - requestedQty);
          variant.availableQuantity = Math.max(0, variant.quantity - (variant.reservedQuantity || 0));
          variant.status = variant.quantity <= 0
            ? 'out_of_stock'
            : (variant.quantity <= (variant.lowStockThreshold || 5) ? 'low_stock' : 'in_stock');

          // Recalculate product-level aggregated inventory
          const totalStock = product.variants.reduce((sum, v) => sum + (v.quantity || 0), 0);
          product.stock = totalStock;
          product.inventory = {
            totalQuantity: totalStock,
            totalReservedQuantity: product.variants.reduce((sum, v) => sum + (v.reservedQuantity || 0), 0),
            totalAvailableQuantity: totalStock,
            lowStockCount: product.variants.filter(v => v.status === 'low_stock').length,
            outOfStockCount: product.variants.filter(v => v.status === 'out_of_stock').length,
            hasVariants: true
          };

          if (totalStock <= 0) {
            product.status = 'OUT_OF_STOCK';
          }

          auditEntries.push({
            productId: product.id,
            variantId: variant.variantId,
            sku: variant.sku || null,
            sellerId: product.sellerId || null,
            previousQuantity: prevQty,
            newQuantity: variant.quantity,
            change: -requestedQty,
            reason: 'ORDER_PLACED',
            source: 'ORDER',
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          });

        } else {
          // Legacy single stock without variants
          const stock = typeof product.stock === 'number' ? product.stock : 999;
          if (requestedQty > stock) {
            throw new ValidationError(
              `Only ${stock} unit(s) of "${product.name}" are available. You requested ${requestedQty}.`
            );
          }

          const prevQty = stock;
          product.stock = Math.max(0, stock - requestedQty);
          if (product.inventory) {
            product.inventory.totalQuantity = product.stock;
            product.inventory.totalAvailableQuantity = product.stock;
          }
          if (product.stock <= 0) {
            product.status = 'OUT_OF_STOCK';
          }

          auditEntries.push({
            productId: product.id,
            variantId: null,
            sku: product.sku || null,
            sellerId: product.sellerId || null,
            previousQuantity: prevQty,
            newQuantity: product.stock,
            change: -requestedQty,
            reason: 'ORDER_PLACED',
            source: 'ORDER',
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          });
        }

        lineItems.push({
          productId:   product.id,
          variantId:   selectedVariantId,
          sku:         selectedSku,
          name:        product.name || 'Ethnic Product',
          category:    product.category || '',
          size:        item.size        || '',
          color:       item.color       || '',
          quantity:    requestedQty,
          unitPrice,
          mrp:         Number(product.price || product.mrp || 0),
          imageUrl:    (Array.isArray(product.images) && product.images[0]) || product.imageUrl || product.image || '',
          sellerId:    product.sellerId || null,
          sellerName:  product.sellerName || product.storeName || '',
        });
      }

      // Coupon validation
      const clientSubtotal = lineItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
      let couponResult = { valid: false, discountAmount: 0 };
      let couponId     = null;
      let couponCode_  = null;

      if (couponCode && couponCode.trim()) {
        couponResult = await CouponService.validate(couponCode.trim(), clientSubtotal, uid);
        if (!couponResult.valid) {
          throw new ValidationError(`Coupon error: ${couponResult.reason}`);
        }
        couponId    = couponResult.couponId;
        couponCode_ = couponResult.couponCode;
      }

      // Financial calculations
      const pricing = PricingService.calculateTotal(lineItems, couponResult, fulfillmentType);
      const sellerIds = [...new Set(lineItems.map(i => i.sellerId).filter(Boolean))];

      // Payment status determination
      let paymentStatus;
      if (paymentMethod === 'Cash on Delivery') {
        paymentStatus = 'Pending (COD)';
      } else {
        paymentStatus = upiUtr ? 'Pending UTR Verification' : 'Pending Payment';
      }

      // Delivery & store handover OTPs
      const deliveryOtp = String(Math.floor(100000 + Math.random() * 900000));
      const storeHandoverOtp = String(Math.floor(100000 + Math.random() * 900000));

      const orderRef = db.collection('orders').doc();
      const orderDoc = {
        userId:          uid,
        userEmail:       email || '',
        customerName:    customerName || '',
        email:           email || '',
        phone:           phone || '',
        items: lineItems.map(i => ({
          productId:  i.productId,
          variantId:  i.variantId,
          sku:        i.sku,
          name:       i.name,
          category:   i.category,
          size:       i.size,
          color:      i.color,
          qty:        i.quantity,
          price:      i.unitPrice,
          mrp:        i.mrp,
          imageUrl:   i.imageUrl,
          sellerId:   i.sellerId,
          sellerName: i.sellerName,
        })),
        subtotal:        pricing.subtotal,
        discountAmount:  pricing.discountAmount,
        shipping:        pricing.shippingAmount,
        tax:             pricing.tax,
        totalAmount:     pricing.grandTotal,
        couponApplied:   couponCode_ || null,
        couponId:        couponId    || null,
        fulfillmentType: fulfillmentType || 'delivery',
        deliveryAddress: fulfillmentType === 'delivery' ? shippingAddress : null,
        paymentMethod:   paymentMethod || 'UPI',
        paymentStatus,
        upiUtr:          upiUtr || null,
        utrSubmittedAt:  upiUtr ? admin.firestore.FieldValue.serverTimestamp() : null,
        sellerIds,
        deliveryOtp,
        storeHandoverOtp,
        storePickupCode: storeHandoverOtp,
        otpVerified:     false,
        pickupVerified:  false,
        status:          'Pending',
        createdAt:       admin.firestore.FieldValue.serverTimestamp(),
        clientCreatedAt: new Date().toISOString(),
      };

      // ── Write operations in transaction ──
      // 1. Save order document
      transaction.set(orderRef, orderDoc);

      // 2. Update each affected product's stock & variants
      for (const pid of Object.keys(productMap)) {
        const pObj = productMap[pid];
        const updatePayload = {
          stock: pObj.data.stock,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        if (pObj.data.variants) updatePayload.variants = pObj.data.variants;
        if (pObj.data.inventory) updatePayload.inventory = pObj.data.inventory;
        if (pObj.data.status) updatePayload.status = pObj.data.status;

        transaction.update(pObj.ref, updatePayload);
      }

      // 3. Write inventory audit logs
      for (const log of auditEntries) {
        log.orderId = orderRef.id;
        const logRef = db.collection('inventoryAuditLogs').doc();
        transaction.set(logRef, log);
      }

      return {
        orderId: orderRef.id,
        pricing,
        couponId,
        couponCode: couponCode_,
        lineItems,
        paymentStatus,
      };
    });

    // ── 3. Post-transaction non-blocking updates ───────────────────
    const { orderId, pricing, couponId, couponCode: couponCode_, lineItems, paymentStatus } = transactionResult;

    db.collection('settings').doc('stats').set(
      { totalOrders: admin.firestore.FieldValue.increment(1), updatedAt: admin.firestore.FieldValue.serverTimestamp() },
      { merge: true }
    ).catch(e => logger.warn('Stats increment failed (non-fatal):', e.message));

    if (couponId) {
      db.collection('couponUsage').add({
        couponId,
        userId:    uid,
        orderId,
        usedAt:    admin.firestore.FieldValue.serverTimestamp(),
      }).catch(e => logger.warn('CouponUsage record failed (non-fatal):', e.message));

      db.collection('coupons').doc(couponId).update({
        usedCount: admin.firestore.FieldValue.increment(1),
      }).catch(e => logger.warn('Coupon usedCount increment failed (non-fatal):', e.message));
    }

    logger.audit('ORDER_CREATED', uid, {
      orderId,
      grandTotal: pricing.grandTotal,
      itemCount: lineItems.length,
      paymentMethod,
      paymentStatus,
    });

    return {
      orderId,
      status:          'Pending',
      paymentStatus,
      subtotal:        pricing.subtotal,
      discountAmount:  pricing.discountAmount,
      shipping:        pricing.shippingAmount,
      totalAmount:     pricing.grandTotal,
      couponApplied:   couponCode_ || null,
      itemCount:       lineItems.length,
      estimatedDelivery: fulfillmentType === 'pickup' ? 'Ready for Pickup in 1-2 days' : '3-7 business days',
    };
  },

  /**
   * Cancel an order and atomically restore purchased quantity to the exact variants.
   */
  async cancelOrder(orderId, uid, isAdmin = false, reason = '') {
    return await db.runTransaction(async (transaction) => {
      const orderRef = db.collection('orders').doc(orderId);
      const orderDoc = await transaction.get(orderRef);
      if (!orderDoc.exists) {
        throw new NotFoundError(`Order "${orderId}"`);
      }

      const orderData = orderDoc.data();

      // Authorization check
      if (!isAdmin && orderData.userId !== uid) {
        throw new AuthorizationError('You do not have permission to cancel this order.');
      }

      // Status check
      const nonCancellable = ['Cancelled', 'Delivered', 'Out for Delivery', 'Collected'];
      if (nonCancellable.includes(orderData.status)) {
        throw new ValidationError(`Order cannot be cancelled in status "${orderData.status}".`);
      }

      const items = Array.isArray(orderData.items) ? orderData.items : [];
      const productIds = [...new Set(items.map(i => i.productId).filter(Boolean))];
      const productDocs = await Promise.all(
        productIds.map(id => transaction.get(db.collection('products').doc(id)))
      );

      const productMap = {};
      productDocs.forEach((doc, idx) => {
        if (doc.exists) {
          productMap[productIds[idx]] = { ref: doc.ref, data: doc.data() };
        }
      });

      const auditEntries = [];

      for (const item of items) {
        const pObj = productMap[item.productId];
        if (!pObj) continue;
        const pData = pObj.data;
        const restoreQty = Number(item.qty || item.quantity || 1);

        if (Array.isArray(pData.variants) && pData.variants.length > 0) {
          const variant = findMatchingVariant(pData, item.variantId, item.size, item.color);
          if (variant) {
            const prevQty = variant.quantity || 0;
            variant.quantity = prevQty + restoreQty;
            variant.availableQuantity = Math.max(0, variant.quantity - (variant.reservedQuantity || 0));
            variant.status = variant.quantity <= 0
              ? 'out_of_stock'
              : (variant.quantity <= (variant.lowStockThreshold || 5) ? 'low_stock' : 'in_stock');

            auditEntries.push({
              productId: item.productId,
              variantId: variant.variantId || null,
              sku: variant.sku || item.sku || null,
              sellerId: item.sellerId || pData.sellerId || null,
              previousQuantity: prevQty,
              newQuantity: variant.quantity,
              change: restoreQty,
              reason: 'ORDER_CANCELLED',
              source: 'ORDER_CANCELLED',
              orderId,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          }

          // Recalculate product-level stock
          const totalStock = pData.variants.reduce((sum, v) => sum + (v.quantity || 0), 0);
          pData.stock = totalStock;
          if (pData.inventory) {
            pData.inventory.totalQuantity = totalStock;
            pData.inventory.totalAvailableQuantity = totalStock;
            pData.inventory.lowStockCount = pData.variants.filter(v => v.status === 'low_stock').length;
            pData.inventory.outOfStockCount = pData.variants.filter(v => v.status === 'out_of_stock').length;
          }
          if (pData.status === 'OUT_OF_STOCK' && totalStock > 0) {
            pData.status = 'ACTIVE';
          }
        } else {
          // Legacy single stock
          const prevQty = typeof pData.stock === 'number' ? pData.stock : 0;
          pData.stock = prevQty + restoreQty;
          if (pData.inventory) {
            pData.inventory.totalQuantity = pData.stock;
            pData.inventory.totalAvailableQuantity = pData.stock;
          }
          if (pData.status === 'OUT_OF_STOCK' && pData.stock > 0) {
            pData.status = 'ACTIVE';
          }

          auditEntries.push({
            productId: item.productId,
            variantId: null,
            sku: item.sku || null,
            sellerId: item.sellerId || pData.sellerId || null,
            previousQuantity: prevQty,
            newQuantity: pData.stock,
            change: restoreQty,
            reason: 'ORDER_CANCELLED',
            source: 'ORDER_CANCELLED',
            orderId,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      }

      // ── Write operations in transaction ──
      for (const pid of Object.keys(productMap)) {
        const pObj = productMap[pid];
        const updatePayload = {
          stock: pObj.data.stock,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        if (pObj.data.variants) updatePayload.variants = pObj.data.variants;
        if (pObj.data.inventory) updatePayload.inventory = pObj.data.inventory;
        if (pObj.data.status) updatePayload.status = pObj.data.status;

        transaction.update(pObj.ref, updatePayload);
      }

      for (const log of auditEntries) {
        transaction.set(db.collection('inventoryAuditLogs').doc(), log);
      }

      transaction.update(orderRef, {
        status: 'Cancelled',
        cancellationReason: reason || 'Customer requested cancellation',
        cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      logger.audit('ORDER_CANCELLED_RESTOCKED', uid, { orderId, reason });
      return { success: true, orderId, status: 'Cancelled' };
    });
  }
};

module.exports = OrderService;
