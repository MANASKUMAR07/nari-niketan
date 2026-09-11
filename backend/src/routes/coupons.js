'use strict';

const { Router } = require('express');
const router     = Router();
const { authenticateFirebaseUser }  = require('../middleware/auth');
const { couponLimiter }             = require('../middleware/rateLimiter');
const { validateCoupon }            = require('../controllers/couponController');

// POST /api/coupons/validate — authenticated + rate limited
router.post('/validate', authenticateFirebaseUser, couponLimiter, validateCoupon);

module.exports = router;
