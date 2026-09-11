'use strict';

const { Router } = require('express');
const router     = Router();
const { authenticateFirebaseUser, requireAdmin, requireOwner } = require('../middleware/auth');
const {
  getAllOrders, updateOrderStatus,
  getAllUsers, setUserRole, blockUser, deleteUser,
  getAllCoupons, createCoupon, updateCoupon, deleteCoupon,
  updateSellerStatus,
  verifyPayment,
  getStats,
  createDeliveryPayout,
} = require('../controllers/adminController');

// All admin routes require authentication AND admin role
router.use(authenticateFirebaseUser, requireAdmin);

// ── Orders
router.get('/orders',                         getAllOrders);
router.patch('/orders/:id/status',            updateOrderStatus);
router.patch('/orders/:id/verify-payment',    verifyPayment);

// ── Users
router.get('/users',                          getAllUsers);
router.patch('/users/:uid/block',             blockUser);
router.delete('/users/:uid',                  deleteUser);

// ── Role management — requireOwner for role elevation (most sensitive operation)
router.patch('/users/:uid/role',              requireOwner, setUserRole);

// ── Sellers
router.patch('/sellers/:uid/status',          updateSellerStatus);

// ── Coupons
router.get('/coupons',                        getAllCoupons);
router.post('/coupons',                       createCoupon);
router.patch('/coupons/:id',                  updateCoupon);
router.delete('/coupons/:id',                 deleteCoupon);

// ── Stats
router.get('/stats',                          getStats);

// ── Payouts
router.post('/payouts',                       createDeliveryPayout);

module.exports = router;
