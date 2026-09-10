'use strict';

const { Router } = require('express');
const router     = Router();
const { authenticateFirebaseUser, requireSeller } = require('../middleware/auth');
const {
  getMyProducts, addProduct, updateProduct, deleteProduct, updateInventory,
  getInventory, getInventoryLogs,
  getMyOrders,
  getEarnings,
  getProfile,
} = require('../controllers/sellerController');

// All seller routes require authentication AND seller role
router.use(authenticateFirebaseUser, requireSeller);

// ── Profile
router.get('/profile',                   getProfile);

// ── Products & Inventory
router.get('/products',                  getMyProducts);
router.post('/products',                 addProduct);
router.patch('/products/:id',            updateProduct);
router.delete('/products/:id',           deleteProduct);
router.patch('/products/:id/inventory',  updateInventory);
router.get('/inventory',                 getInventory);
router.get('/inventory/logs',            getInventoryLogs);

// ── Orders (seller's own orders only)
router.get('/orders',                    getMyOrders);

// ── Earnings
router.get('/earnings',                  getEarnings);

module.exports = router;
