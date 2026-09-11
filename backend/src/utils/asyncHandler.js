// =============================================
// NARI NIKETAN — Async Handler Wrapper
// =============================================
// Wraps async route handlers so that rejected promises
// are automatically forwarded to Express error middleware
// instead of crashing the process.

'use strict';

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

module.exports = asyncHandler;
