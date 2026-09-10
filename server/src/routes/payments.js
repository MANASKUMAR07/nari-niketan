'use strict';

const { Router } = require('express');
const router     = Router();
const { authenticateFirebaseUser }      = require('../middleware/auth');
const { paymentLimiter }               = require('../middleware/rateLimiter');
const { submitUtr, getPaymentStatus }  = require('../controllers/paymentController');

// All payment routes require authentication
router.use(authenticateFirebaseUser);

router.post('/submit-utr',       paymentLimiter, submitUtr);      // POST /api/payments/submit-utr
router.get('/status/:orderId',   getPaymentStatus);                // GET  /api/payments/status/:orderId

module.exports = router;
