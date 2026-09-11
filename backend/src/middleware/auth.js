// =============================================
// NARI NIKETAN — Authentication & Authorization Middleware
// =============================================
// SECURITY RULES:
//   1. The authenticated UID is ALWAYS taken from the verified Firebase ID token.
//   2. We never trust req.body.userId, req.query.userId, or any client-supplied identity.
//   3. Role checks (admin, seller) verify Firebase Custom Claims set by the Admin SDK.
//   4. Firestore user-document role fields are a secondary fallback for legacy users only.

'use strict';

const { auth, db }             = require('../config/firebase');
const { AuthenticationError, AuthorizationError } = require('../utils/errors');
const logger                   = require('../utils/logger');

// ── 1. AUTHENTICATE — verify Firebase ID token ────────────────────────────────
//
// Usage:  router.post('/orders', authenticateFirebaseUser, controller)
//
// After this middleware runs:
//   req.user.uid        — verified Firebase UID (never trust client-supplied uid)
//   req.user.email      — verified email (if set)
//   req.user.claims     — decoded Firebase Custom Claims
//   req.user.token      — raw decoded token (for downstream inspection)

const authenticateFirebaseUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      logger.authFailure('Missing or malformed Authorization header', req);
      return next(new AuthenticationError('Authorization header must be: Bearer <Firebase ID Token>'));
    }

    const idToken = authHeader.slice(7);
    if (!idToken) {
      logger.authFailure('Empty token', req);
      return next(new AuthenticationError('Firebase ID token is missing'));
    }

    const decodedToken = await auth.verifyIdToken(idToken, /* checkRevoked */ true);

    req.user = {
      uid:    decodedToken.uid,
      email:  decodedToken.email  || null,
      phone:  decodedToken.phone_number || null,
      claims: decodedToken,       // full decoded token including custom claims
      token:  decodedToken,
    };

    next();
  } catch (err) {
    logger.authFailure(`Token verification failed: ${err.code || err.message}`, req);

    if (err.code === 'auth/id-token-expired') {
      return next(new AuthenticationError('Session expired. Please sign in again.'));
    }
    if (err.code === 'auth/id-token-revoked') {
      return next(new AuthenticationError('Session revoked. Please sign in again.'));
    }
    return next(new AuthenticationError('Invalid authentication token.'));
  }
};

// ── 2. REQUIRE ADMIN ─────────────────────────────────────────────────────────
//
// Must run AFTER authenticateFirebaseUser.
// Checks Firebase Custom Claims: admin === true  OR  owner === true
// Falls back to Firestore isAdmin field for legacy users that pre-date custom claims.

const requireAdmin = async (req, res, next) => {
  if (!req.user) {
    return next(new AuthenticationError());
  }

  const claims = req.user.claims;

  // 1. Check Custom Claims first (preferred, fast, no Firestore round-trip)
  if (claims.admin === true || claims.owner === true) {
    return next();
  }

  // 2. Fallback: check Firestore isAdmin for legacy users
  try {
    const userDoc = await db.collection('users').doc(req.user.uid).get();
    if (userDoc.exists && userDoc.data().isAdmin === true) {
      // Auto-promote: set the custom claim so future requests skip Firestore
      auth.setCustomUserClaims(req.user.uid, {
        ...claims,
        admin: true,
      }).catch(e => logger.warn('Could not auto-set admin claim:', e));
      return next();
    }
  } catch (e) {
    logger.warn(`requireAdmin Firestore fallback error for ${req.user.uid}:`, e.message);
  }

  logger.authzFailure(req.user.uid, req.path, 'ADMIN_REQUIRED');
  return next(new AuthorizationError('Admin access required.'));
};

// ── 3. REQUIRE OWNER ─────────────────────────────────────────────────────────
//
// Reserved for the highest privilege operations (e.g. role assignment).
// Only accounts with owner === true in their Custom Claims are allowed.

const requireOwner = (req, res, next) => {
  if (!req.user || req.user.claims.owner !== true) {
    logger.authzFailure(req.user?.uid, req.path, 'OWNER_REQUIRED');
    return next(new AuthorizationError('Owner access required.'));
  }
  next();
};

// ── 4. REQUIRE SELLER ─────────────────────────────────────────────────────────
//
// Must run AFTER authenticateFirebaseUser.
// Checks Custom Claims: seller === true  OR  admin === true (admins can do everything)
// Falls back to Firestore sellerStatus for legacy users.

const requireSeller = async (req, res, next) => {
  if (!req.user) {
    return next(new AuthenticationError());
  }

  const claims = req.user.claims;

  // Admins and owners can access all seller routes
  if (claims.admin === true || claims.owner === true) {
    return next();
  }

  // 1. Check Custom Claims
  if (claims.seller === true) {
    return next();
  }

  // 2. Fallback: check Firestore for legacy sellers
  try {
    const userDoc = await db.collection('users').doc(req.user.uid).get();
    if (userDoc.exists) {
      const data = userDoc.data();
      if (data.isSeller === true || data.sellerStatus === 'approved') {
        // Auto-set custom claim
        auth.setCustomUserClaims(req.user.uid, {
          ...claims,
          seller: true,
        }).catch(e => logger.warn('Could not auto-set seller claim:', e));
        return next();
      }
    }
  } catch (e) {
    logger.warn(`requireSeller Firestore fallback error for ${req.user.uid}:`, e.message);
  }

  logger.authzFailure(req.user.uid, req.path, 'SELLER_REQUIRED');
  return next(new AuthorizationError('Seller access required. Apply to become a seller first.'));
};

// ── 5. REQUIRE SELF OR ADMIN ──────────────────────────────────────────────────
//
// Ensures the authenticated user can only access their own resource,
// unless they are an admin.
//
// Usage: router.get('/users/:uid/orders', authenticateFirebaseUser, requireSelfOrAdmin('uid'))

const requireSelfOrAdmin = (paramName = 'uid') => async (req, res, next) => {
  if (!req.user) return next(new AuthenticationError());

  const targetUid = req.params[paramName];
  const claims    = req.user.claims;

  if (req.user.uid === targetUid || claims.admin === true || claims.owner === true) {
    return next();
  }

  logger.authzFailure(req.user.uid, req.path, 'SELF_OR_ADMIN_REQUIRED');
  return next(new AuthorizationError());
};

module.exports = {
  authenticateFirebaseUser,
  requireAdmin,
  requireOwner,
  requireSeller,
  requireSelfOrAdmin,
};
