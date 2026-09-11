'use strict';

const { Router } = require('express');
const router     = Router();
const { authenticateFirebaseUser } = require('../middleware/auth');
const { orderLimiter }             = require('../middleware/rateLimiter');
const { createOrder, getMyOrders, getOrder, cancelOrder } = require('../controllers/orderController');

// All order routes require authentication
router.use(authenticateFirebaseUser);

router.post('/',           orderLimiter, createOrder);   // POST /api/orders
router.get('/my',          getMyOrders);                  // GET  /api/orders/my
router.get('/:id',         getOrder);                     // GET  /api/orders/:id
router.post('/:id/cancel', cancelOrder);                  // POST /api/orders/:id/cancel

module.exports = router;
