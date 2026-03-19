// src/middlewares/auth.js
// ============================================================
// AEKADS Authentication Middleware — FIXED VERSION
// Ensures req.user always has: { userId, orgId, email }
// regardless of how the JWT was originally signed
// ============================================================
const jwt = require('jsonwebtoken');
const { AppError } = require('./errorHandler');
const logger = require('../utils/logger');

// ─────────────────────────────────────────────────────────────
// authenticate — standard user JWT
// ─────────────────────────────────────────────────────────────
const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(new AppError('No token provided', 401));
    }

    const token = authHeader.split(' ')[1];

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        const expiredError = new AppError('Token expired', 401);
        expiredError.code = 'TOKEN_EXPIRED';
        return next(expiredError);
      }
      return next(new AppError('Invalid token', 401));
    }

    // ── Normalise ALL possible JWT field shapes ───────────────
    // authController signs as: { userId, orgId, email }
    // Some older tokens might use { id, organizationId, ... }
    const userId = decoded.userId || decoded.id || decoded.sub || null;
    const orgId  = decoded.orgId  || decoded.organizationId || decoded.org_id || null;

    if (!userId) {
      logger.error('JWT missing userId field:', decoded);
      return next(new AppError('Invalid token: missing user identifier', 401));
    }

    if (!orgId) {
      logger.error('JWT missing orgId field:', decoded);
      return next(new AppError('Invalid token: missing org identifier', 401));
    }

    // Always set BOTH field names so any code that reads either works
    req.user = {
      ...decoded,
      userId,   // canonical
      id: userId, // alias
      orgId,    // canonical
      organizationId: orgId, // alias
      email: decoded.email,
    };

    next();
  } catch (err) {
    logger.error('authenticate error:', err.message);
    next(new AppError('Authentication failed', 401));
  }
};

// ─────────────────────────────────────────────────────────────
// authenticateDevice — device JWT (screen players)
// ─────────────────────────────────────────────────────────────
const authenticateDevice = (req, res, next) => {
  try {
    // Support both header formats
    const authHeader = req.headers.authorization;
    const deviceHeader = req.headers['x-device-token'];

    let token = null;

    if (deviceHeader) {
      token = deviceHeader;
    } else if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }

    if (!token) {
      return next(new AppError('No device token provided', 401));
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.DEVICE_JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return next(new AppError('Device token expired', 401));
      }
      return next(new AppError('Invalid device token', 401));
    }

    const screenId = decoded.screenId || decoded.screen_id || null;
    const orgId    = decoded.orgId    || decoded.org_id    || null;

    if (!screenId || !orgId) {
      return next(new AppError('Invalid device token payload', 401));
    }

    req.device = { screenId, orgId, ...decoded };
    // Also set req.user so RBAC middleware doesn't crash on device routes
    req.user = { userId: screenId, orgId, isDevice: true };

    next();
  } catch (err) {
    logger.error('authenticateDevice error:', err.message);
    next(new AppError('Device authentication failed', 401));
  }
};

// ─────────────────────────────────────────────────────────────
// optionalAuth — attaches user if token present, doesn't block
// ─────────────────────────────────────────────────────────────
const optionalAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return next();

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const userId = decoded.userId || decoded.id || decoded.sub;
    const orgId  = decoded.orgId  || decoded.organizationId || decoded.org_id;

    if (userId && orgId) {
      req.user = {
        ...decoded,
        userId,
        id: userId,
        orgId,
        organizationId: orgId,
      };
    }
  } catch {
    // Silently fail — optional auth
  }
  next();
};

module.exports = { authenticate, authenticateDevice, optionalAuth };