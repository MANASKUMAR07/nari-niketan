// =============================================
// NARI NIKETAN — Structured Logger (Winston)
// =============================================
// Sensitive data (tokens, keys, passwords) must NEVER be logged.

'use strict';

const { createLogger, format, transports } = require('winston');

const logger = createLogger({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    process.env.NODE_ENV === 'production'
      ? format.json()
      : format.combine(format.colorize(), format.simple())
  ),
  defaultMeta: { service: 'nari-niketan-api' },
  transports: [
    new transports.Console(),
  ],
});

// Convenience wrappers for structured audit events
logger.audit = (event, uid, details = {}) => {
  logger.info({ type: 'AUDIT', event, uid, ...details });
};

logger.authFailure = (reason, req) => {
  logger.warn({
    type:   'AUTH_FAILURE',
    reason,
    ip:     req.ip,
    path:   req.path,
    method: req.method,
  });
};

logger.authzFailure = (uid, resource, action) => {
  logger.warn({ type: 'AUTHZ_FAILURE', uid, resource, action });
};

module.exports = logger;
