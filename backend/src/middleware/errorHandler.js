// =============================================
// NARI NIKETAN — Global Error Handler
// =============================================
// SECURITY: Internal error details (stack traces, DB internals, env vars)
// are NEVER sent to the client. Only safe, user-friendly messages are returned.

'use strict';

const { AppError }  = require('../utils/errors');
const logger        = require('../utils/logger');

const errorHandler = (err, req, res, next) => { // eslint-disable-line no-unused-vars
  // Log full error details server-side only
  if (err.isOperational) {
    logger.warn({
      type:    'OPERATIONAL_ERROR',
      code:    err.code,
      status:  err.statusCode,
      message: err.message,
      path:    req.path,
      uid:     req.user?.uid || 'unauthenticated',
    });
  } else {
    logger.error({
      type:    'UNEXPECTED_ERROR',
      message: err.message,
      stack:   err.stack,
      path:    req.path,
      uid:     req.user?.uid || 'unauthenticated',
    });
  }

  // Zod validation errors
  if (err.name === 'ZodError') {
    const details = err.errors.map(e => ({
      field:   e.path.join('.'),
      message: e.message,
    }));
    return res.status(400).json({
      success: false,
      error:   'Invalid request data.',
      details,
    });
  }

  // Operational errors — safe to return message to client
  if (err.isOperational) {
    const body = {
      success: false,
      error:   err.message,
    };
    if (err.details) body.details = err.details;
    return res.status(err.statusCode).json(body);
  }

  // Unexpected / programming errors — never expose internals
  return res.status(500).json({
    success: false,
    error:   'An unexpected error occurred. Please try again later.',
  });
};

module.exports = errorHandler;
