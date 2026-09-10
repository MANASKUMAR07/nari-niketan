// =============================================
// NARI NIKETAN — Express Application Entry Point
// =============================================

'use strict';

// Load env vars FIRST, before any other module reads process.env
require('dotenv').config();

const express      = require('express');
const helmet       = require('helmet');
const cors         = require('cors');
const morgan       = require('morgan');

const logger        = require('./utils/logger');
const errorHandler  = require('./middleware/errorHandler');
const { standardLimiter } = require('./middleware/rateLimiter');

// ── Lazy-init Firebase Admin on first request (speeds up cold start) ──
// Import initialises the SDK — do it at startup to catch config errors early.
require('./config/firebase');

// ── Routes ─────────────────────────────────────────────────────────────────
const healthRoutes  = require('./routes/health');
const orderRoutes   = require('./routes/orders');
const couponRoutes  = require('./routes/coupons');
const paymentRoutes = require('./routes/payments');
const adminRoutes   = require('./routes/admin');
const sellerRoutes  = require('./routes/seller');
const imageRoutes   = require('./routes/images');
const agentRoutes   = require('./routes/agentRoutes');

const app = express();

// ── Security headers (Helmet) ───────────────────────────────────────────────
app.use(helmet({
  crossOriginEmbedderPolicy: false, // not needed for API-only backend
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'none'"],
      // API responses are JSON — no scripts, no styles, no frames
    },
  },
}));

// ── CORS ────────────────────────────────────────────────────────────────────
const defaultOrigins = [
  'https://nari-niketan.web.app',
  'https://nari-niketan.firebaseapp.com',
  'https://nariniketan.shop',
  'https://www.nariniketan.shop',
  'http://localhost',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:8080',
  'http://127.0.0.1:8080',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173'
];

const envOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

const allowedOrigins = Array.from(new Set([...defaultOrigins, ...envOrigins]));

app.use(cors({
  origin(origin, callback) {
    // Allow requests with no origin (server-to-server, Postman, Cloud Run health checks)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) return callback(null, true);
    logger.warn({ type: 'CORS_BLOCKED', origin });
    callback(new Error(`CORS: Origin "${origin}" is not allowed.`));
  },
  methods:      ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type', 'X-Request-ID', 'x-gemini-key', 'x-api-key'],
  credentials:  false, // API uses Bearer tokens, not cookies
}));

// ── Request size limit (support high-res photo multimodal analysis) ────────
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: false, limit: '20mb' }));

// ── HTTP request logging ────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined', {
    stream: { write: (msg) => logger.info(msg.trim()) },
    // Skip health check logging in production to reduce noise
    skip: (req) => process.env.NODE_ENV === 'production' && req.path === '/api/health',
  }));
}

// ── Global rate limiter (applied to all routes) ────────────────────────────
app.use(standardLimiter);

// ── Trust proxy (required for Cloud Run to get correct client IP) ─────────
app.set('trust proxy', 1);

// ── Root / welcome route ───────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '🌸 Nari Niketan Backend API is active and secure.',
    service: 'nari-niketan-api',
    version: '1.0.0',
    health:  '/api/health',
    documentation: 'All API routes are hosted under /api/*',
  });
});

// ── Routes ─────────────────────────────────────────────────────────────────
app.use('/api/health',    healthRoutes);
app.use('/api/orders',    orderRoutes);
app.use('/api/coupons',   couponRoutes);
app.use('/api/payments',  paymentRoutes);
app.use('/api/admin',     adminRoutes);
app.use('/api/seller',    sellerRoutes);
app.use('/api/images',    imageRoutes);
app.use('/api/v1/agent',  agentRoutes);
app.use('/api/agent',     agentRoutes);

// ── 404 handler ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, error: `Route ${req.method} ${req.path} not found.` });
});

// ── Global error handler (must be last) ────────────────────────────────────
app.use(errorHandler);

// ── Start server ────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '8080', 10);

app.listen(PORT, '0.0.0.0', () => {
  logger.info(`🚀 Nari Niketan API listening on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
});

module.exports = app; // for testing
