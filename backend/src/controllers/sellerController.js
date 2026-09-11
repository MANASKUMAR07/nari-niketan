// =============================================
// NARI NIKETAN — Seller Controller
// =============================================
// All routes require: authenticateFirebaseUser + requireSeller
// Sellers can ONLY access their own products/orders/inventory.
// The sellerId on every resource is verified against req.user.uid.

'use strict';

const admin        = require('firebase-admin');
const { db }       = require('../config/firebase');
const asyncHandler = require('../utils/asyncHandler');
const { NotFoundError, AuthorizationError, ValidationError } = require('../utils/errors');
const logger       = require('../utils/logger');
const {
  upsertProductSchema,
  updateInventorySchema,
  quickUpdateInventorySchema
} = require('../validators/sellerValidator');

/**
 * Computes aggregated inventory stats and derived statuses from variants array.
 */
function computeInventoryMetrics(variants, fallbackStock = 0, fallbackLowThreshold = 5) {
  if (Array.isArray(variants) && variants.length > 0) {
    let totalQuantity = 0;
    let totalReserved = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    const normalizedVariants = variants.map(v => {
      const q = Number(v.quantity || 0);
      const res = Number(v.reservedQuantity || 0);
      const avail = Math.max(0, q - res);
      const threshold = Number(v.lowStockThreshold || fallbackLowThreshold);
      const status = q <= 0 ? 'out_of_stock' : (q <= threshold ? 'low_stock' : 'in_stock');

      totalQuantity += q;
      totalReserved += res;
      if (status === 'out_of_stock') outOfStockCount++;
      else if (status === 'low_stock') lowStockCount++;

      return {
        ...v,
        quantity: q,
        reservedQuantity: res,
        availableQuantity: avail,
        lowStockThreshold: threshold,
        status,
        active: v.active !== false,
      };
    });

    return {
      variants: normalizedVariants,
      stock: totalQuantity,
      inventory: {
        totalQuantity,
        totalReservedQuantity: totalReserved,
        totalAvailableQuantity: Math.max(0, totalQuantity - totalReserved),
        lowStockCount,
        outOfStockCount,
        hasVariants: true,
      },
      status: totalQuantity <= 0 ? 'OUT_OF_STOCK' : 'ACTIVE',
    };
  }

  // Single product without variants
  const q = Number(fallbackStock || 0);
  const status = q <= 0 ? 'OUT_OF_STOCK' : 'ACTIVE';
  return {
    variants: [],
    stock: q,
    inventory: {
      totalQuantity: q,
      totalReservedQuantity: 0,
      totalAvailableQuantity: q,
      lowStockCount: q <= fallbackLowThreshold && q > 0 ? 1 : 0,
      outOfStockCount: q <= 0 ? 1 : 0,
      hasVariants: false,
    },
    status,
  };
}

// ── PRODUCTS ─────────────────────────────────────────────────────────────────

// GET /api/seller/products
const getMyProducts = asyncHandler(async (req, res) => {
  const uid = req.user.uid;

  const snap = await db.collection('products')
    .where('sellerId', '==', uid)
    .get();

  const products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  products.sort((a, b) => {
    const t = x => x.createdAt?.toMillis?.() || x.createdAt?.seconds * 1000 || 0;
    return t(b) - t(a);
  });

  res.json({ success: true, products });
});

// POST /api/seller/products
const addProduct = asyncHandler(async (req, res) => {
  const uid  = req.user.uid;
  const data = upsertProductSchema.parse(req.body);

  // Fetch seller profile to embed seller name
  const userDoc    = await db.collection('users').doc(uid).get();
  const sellerName = userDoc.exists ? (userDoc.data().storeName || userDoc.data().name || '') : '';

  // Calculate variant-level stock and aggregated metrics
  const fallbackStock = Number(data.stock || 0);
  const lowThresh = Number(data.lowStockThreshold || 5);
  const inventoryInfo = computeInventoryMetrics(data.variants, fallbackStock, lowThresh);

  const finalStatus = data.draft ? 'DRAFT' : (data.status || inventoryInfo.status);

  // sellerId is ALWAYS set from the verified token — never from request body
  const productDoc = {
    ...data,
    sellerId:   uid,
    sellerName,
    variants:   inventoryInfo.variants,
    stock:      inventoryInfo.stock,
    inventory:  inventoryInfo.inventory,
    status:     finalStatus,
    active:     !data.draft && data.active !== false,
    createdAt:  admin.firestore.FieldValue.serverTimestamp(),
    updatedAt:  admin.firestore.FieldValue.serverTimestamp(),
    createdBy:  uid,
  };

  const ref = await db.collection('products').add(productDoc);

  // Record initial stock in audit logs
  if (inventoryInfo.variants.length > 0) {
    const batch = db.batch();
    for (const v of inventoryInfo.variants) {
      const logRef = db.collection('inventoryAuditLogs').doc();
      batch.set(logRef, {
        productId: ref.id,
        variantId: v.variantId,
        sku: v.sku || data.sku || null,
        sellerId: uid,
        previousQuantity: 0,
        newQuantity: v.quantity,
        change: v.quantity,
        reason: 'INITIAL_PRODUCT_CREATION',
        source: 'SELLER_MANUAL_UPDATE',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    batch.commit().catch(e => logger.warn('Initial inventory batch log failed (non-fatal):', e.message));
  }

  logger.audit('SELLER_ADD_PRODUCT', uid, { productId: ref.id, name: data.name, stock: inventoryInfo.stock });
  res.status(201).json({ success: true, productId: ref.id });
});

// PATCH /api/seller/products/:id
const updateProduct = asyncHandler(async (req, res) => {
  const uid       = req.user.uid;
  const { id }    = req.params;
  const updates   = upsertProductSchema.partial().parse(req.body);

  const doc = await db.collection('products').doc(id).get();
  if (!doc.exists) throw new NotFoundError('Product');

  // CRITICAL: verify ownership
  if (doc.data().sellerId !== uid) {
    logger.authzFailure(uid, `seller/products/${id}`, 'NOT_PRODUCT_OWNER');
    throw new AuthorizationError('You can only edit your own products.');
  }

  // Prevent sellerId override — it is immutable
  delete updates.sellerId;

  // Recalculate inventory if variants or stock are present in update
  if (updates.variants !== undefined || updates.stock !== undefined) {
    const variants = updates.variants !== undefined ? updates.variants : doc.data().variants;
    const stock = updates.stock !== undefined ? updates.stock : doc.data().stock;
    const lowThresh = updates.lowStockThreshold || doc.data().lowStockThreshold || 5;
    const inventoryInfo = computeInventoryMetrics(variants, stock, lowThresh);

    updates.variants = inventoryInfo.variants;
    updates.stock = inventoryInfo.stock;
    updates.inventory = inventoryInfo.inventory;
    if (!updates.draft && !updates.status) {
      updates.status = inventoryInfo.status;
    }
  }

  await db.collection('products').doc(id).update({
    ...updates,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  logger.audit('SELLER_UPDATE_PRODUCT', uid, { productId: id });
  res.json({ success: true, message: 'Product updated.' });
});

// DELETE /api/seller/products/:id
const deleteProduct = asyncHandler(async (req, res) => {
  const uid    = req.user.uid;
  const { id } = req.params;

  const doc = await db.collection('products').doc(id).get();
  if (!doc.exists) throw new NotFoundError('Product');

  // CRITICAL: verify ownership
  if (doc.data().sellerId !== uid) {
    logger.authzFailure(uid, `seller/products/${id}`, 'NOT_PRODUCT_OWNER');
    throw new AuthorizationError('You can only delete your own products.');
  }

  await db.collection('products').doc(id).delete();
  logger.audit('SELLER_DELETE_PRODUCT', uid, { productId: id });
  res.json({ success: true, message: 'Product deleted.' });
});

// PATCH /api/seller/products/:id/inventory
// Quick stock update for a variant or the entire product
const updateInventory = asyncHandler(async (req, res) => {
  const uid       = req.user.uid;
  const { id }    = req.params;
  const parsed    = updateInventorySchema.parse(req.body);
  const newQty    = parsed.quantity !== undefined ? parsed.quantity : parsed.stock;
  const variantId = parsed.variantId || null;
  const reason    = parsed.reason || 'SELLER_MANUAL_UPDATE';

  const docRef = db.collection('products').doc(id);
  const doc = await docRef.get();
  if (!doc.exists) throw new NotFoundError('Product');
  const pData = doc.data();

  if (pData.sellerId !== uid) {
    throw new AuthorizationError('You can only update your own product inventory.');
  }

  let prevQty = 0;
  const updatePayload = {
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (Array.isArray(pData.variants) && pData.variants.length > 0) {
    let targetVariant = null;
    if (variantId) {
      targetVariant = pData.variants.find(v => v.variantId === variantId);
    }
    if (!targetVariant && pData.variants.length === 1) {
      targetVariant = pData.variants[0];
    }

    if (!targetVariant && variantId) {
      throw new NotFoundError(`Variant "${variantId}"`);
    }

    if (targetVariant) {
      prevQty = targetVariant.quantity || 0;
      targetVariant.quantity = newQty;
      targetVariant.availableQuantity = Math.max(0, newQty - (targetVariant.reservedQuantity || 0));
      targetVariant.status = newQty <= 0
        ? 'out_of_stock'
        : (newQty <= (targetVariant.lowStockThreshold || 5) ? 'low_stock' : 'in_stock');
    }

    const totalStock = pData.variants.reduce((sum, v) => sum + (v.quantity || 0), 0);
    const lowStockCount = pData.variants.filter(v => v.status === 'low_stock').length;
    const outOfStockCount = pData.variants.filter(v => v.status === 'out_of_stock').length;

    updatePayload.variants = pData.variants;
    updatePayload.stock = totalStock;
    updatePayload.inventory = {
      totalQuantity: totalStock,
      totalReservedQuantity: pData.variants.reduce((sum, v) => sum + (v.reservedQuantity || 0), 0),
      totalAvailableQuantity: totalStock,
      lowStockCount,
      outOfStockCount,
      hasVariants: true,
    };

    if (totalStock <= 0) {
      updatePayload.status = 'OUT_OF_STOCK';
    } else if (pData.status === 'OUT_OF_STOCK') {
      updatePayload.status = 'ACTIVE';
    }
  } else {
    // Single product without variants
    prevQty = typeof pData.stock === 'number' ? pData.stock : 0;
    updatePayload.stock = newQty;
    updatePayload.inventory = {
      totalQuantity: newQty,
      totalReservedQuantity: 0,
      totalAvailableQuantity: newQty,
      lowStockCount: newQty <= 5 && newQty > 0 ? 1 : 0,
      outOfStockCount: newQty <= 0 ? 1 : 0,
      hasVariants: false,
    };
    if (newQty <= 0) {
      updatePayload.status = 'OUT_OF_STOCK';
    } else if (pData.status === 'OUT_OF_STOCK') {
      updatePayload.status = 'ACTIVE';
    }
  }

  await docRef.update(updatePayload);

  // Write inventory audit log
  const auditEntry = {
    productId: id,
    variantId: variantId || null,
    sellerId: uid,
    previousQuantity: prevQty,
    newQuantity: newQty,
    change: newQty - prevQty,
    reason,
    source: 'SELLER_MANUAL_UPDATE',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  await db.collection('inventoryAuditLogs').add(auditEntry);

  logger.audit('SELLER_UPDATE_INVENTORY', uid, { productId: id, variantId, prevQty, newQty, reason });
  res.json({
    success: true,
    message: `Inventory updated successfully to ${newQty}.`,
    stock: updatePayload.stock,
    variantId
  });
});

// GET /api/seller/inventory
// Returns all variants flattened for the inventory table with summary stats
const getInventory = asyncHandler(async (req, res) => {
  const uid = req.user.uid;
  const snap = await db.collection('products')
    .where('sellerId', '==', uid)
    .get();

  const items = [];
  let totalStock = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;

  snap.docs.forEach(d => {
    const p = d.data();
    const pId = d.id;
    const pName = p.name || 'Untitled Product';
    const category = p.category || '';
    const img = p.thumbnail || p.imageUrl || (Array.isArray(p.images) && p.images[0]) || '';
    const fallbackLow = p.lowStockThreshold || 5;

    if (Array.isArray(p.variants) && p.variants.length > 0) {
      p.variants.forEach(v => {
        const q = Number(v.quantity || 0);
        const threshold = v.lowStockThreshold || fallbackLow;
        const status = q <= 0 ? 'out_of_stock' : (q <= threshold ? 'low_stock' : 'in_stock');
        if (status === 'out_of_stock') outOfStockCount++;
        else if (status === 'low_stock') lowStockCount++;
        totalStock += q;

        items.push({
          productId: pId,
          productName: pName,
          category,
          imageUrl: img,
          variantId: v.variantId,
          sku: v.sku || p.sku || '',
          size: v.size || '',
          color: v.color || '',
          colorCode: v.colorCode || null,
          quantity: q,
          availableQuantity: v.availableQuantity !== undefined ? v.availableQuantity : q,
          lowStockThreshold: threshold,
          price: v.price || p.salePrice || p.price,
          status,
          active: v.active !== false && p.active !== false,
          updatedAt: p.updatedAt || p.createdAt,
        });
      });
    } else {
      const q = Number(p.stock || 0);
      const status = q <= 0 ? 'out_of_stock' : (q <= fallbackLow ? 'low_stock' : 'in_stock');
      if (status === 'out_of_stock') outOfStockCount++;
      else if (status === 'low_stock') lowStockCount++;
      totalStock += q;

      items.push({
        productId: pId,
        productName: pName,
        category,
        imageUrl: img,
        variantId: 'default',
        sku: p.sku || '',
        size: 'Single',
        color: 'Standard',
        colorCode: null,
        quantity: q,
        availableQuantity: q,
        lowStockThreshold: fallbackLow,
        price: p.salePrice || p.price,
        status,
        active: p.active !== false,
        updatedAt: p.updatedAt || p.createdAt,
      });
    }
  });

  res.json({
    success: true,
    summary: {
      totalProducts: snap.size,
      totalVariants: items.length,
      totalStock,
      lowStockCount,
      outOfStockCount,
    },
    items,
  });
});

// GET /api/seller/inventory/logs
// Returns inventory change audit trail for the seller
const getInventoryLogs = asyncHandler(async (req, res) => {
  const uid = req.user.uid;
  try {
    const snap = await db.collection('inventoryAuditLogs')
      .where('sellerId', '==', uid)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();
    const logs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json({ success: true, logs });
  } catch (e) {
    // Fallback without index if needed
    const snap = await db.collection('inventoryAuditLogs')
      .where('sellerId', '==', uid)
      .get();
    const logs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    logs.sort((a, b) => {
      const t = x => x.createdAt?.toMillis?.() || 0;
      return t(b) - t(a);
    });
    res.json({ success: true, logs: logs.slice(0, 50) });
  }
});

// ── ORDERS ───────────────────────────────────────────────────────────────────

// GET /api/seller/orders
// Returns only orders that contain items belonging to this seller.
const getMyOrders = asyncHandler(async (req, res) => {
  const uid = req.user.uid;

  const snap = await db.collection('orders')
    .where('sellerIds', 'array-contains', uid)
    .get();

  const orders = snap.docs.map(d => {
    const data = d.data();
    const myItems = (data.items || []).filter(i => i.sellerId === uid);
    return {
      id:              d.id,
      status:          data.status,
      paymentStatus:   data.paymentStatus,
      customerName:    data.customerName,
      phone:           data.phone,
      deliveryAddress: data.deliveryAddress,
      fulfillmentType: data.fulfillmentType,
      items:           myItems,
      createdAt:       data.createdAt,
    };
  });

  res.json({ success: true, orders });
});

// ── EARNINGS ─────────────────────────────────────────────────────────────────

// GET /api/seller/earnings
const getEarnings = asyncHandler(async (req, res) => {
  const uid = req.user.uid;

  const snap = await db.collection('orders')
    .where('sellerIds', 'array-contains', uid)
    .get();

  const now        = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfWeek  = new Date(now.setDate(now.getDate() - now.getDay())).getTime();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  let totalRevenue = 0, monthRevenue = 0, weekRevenue = 0, dayRevenue = 0;

  for (const doc of snap.docs) {
    const d    = doc.data();
    if (d.status === 'Cancelled') continue;

    const dMs  = d.createdAt?.toMillis?.() || 0;
    const myItems = (d.items || []).filter(i => i.sellerId === uid);
    const itemRevenue = myItems.reduce((s, i) => s + (i.price * i.qty), 0);

    totalRevenue += itemRevenue;
    if (dMs >= startOfMonth) monthRevenue += itemRevenue;
    if (dMs >= startOfWeek)  weekRevenue  += itemRevenue;
    if (dMs >= startOfDay)   dayRevenue   += itemRevenue;
  }

  res.json({
    success: true,
    earnings: {
      totalRevenue, monthRevenue, weekRevenue, dayRevenue,
      totalOrders: snap.size,
    },
  });
});

// ── PROFILE ──────────────────────────────────────────────────────────────────

// GET /api/seller/profile
const getProfile = asyncHandler(async (req, res) => {
  const uid = req.user.uid;
  const doc = await db.collection('users').doc(uid).get();
  if (!doc.exists) throw new NotFoundError('Seller profile');
  const data = doc.data();

  res.json({
    success: true,
    profile: {
      uid,
      name:             data.name,
      email:            data.email,
      phone:            data.phone,
      storeName:        data.storeName,
      storeDescription: data.storeDescription,
      sellerStatus:     data.sellerStatus,
      isSeller:         data.isSeller,
      photoURL:         data.photoURL,
      gstNumber:        data.gstNumber,
      bankDetails:      data.bankDetails,
    },
  });
});

module.exports = {
  getMyProducts,
  addProduct,
  updateProduct,
  deleteProduct,
  updateInventory,
  getInventory,
  getInventoryLogs,
  getMyOrders,
  getEarnings,
  getProfile,
  computeInventoryMetrics,
};
