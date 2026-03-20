// ============================================================
// AEKADS Digital Signage - Main Server (Single URL Deployment)
// ============================================================
require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const cluster = require('cluster');
const os = require('os');

const logger = require('./utils/logger');
const { initializeSocket } = require('./sockets');
const { initializeJobs } = require('./jobs');
const routes = require('./routes');
const { errorHandler, notFound } = require('./middlewares/errorHandler');
const { cleanupStores } = require('./utils/rateLimitStores');

// Cluster mode for multi-core processing
if (cluster.isMaster && process.env.NODE_ENV === 'production' && process.env.ENABLE_CLUSTER === 'true') {
  const numCPUs = os.cpus().length;
  logger.info(`Master ${process.pid} is running`);
  logger.info(`Starting ${numCPUs} workers...`);

  // Fork workers
  for (let i = 0; i < numCPUs; i++) { 
    cluster.fork();
  }

  // Handle worker crashes
  cluster.on('exit', (worker, code, signal) => {
    logger.error(`Worker ${worker.process.pid} died. Restarting...`);
    cluster.fork();
  });

} else {
  // Worker process
  const app = express();
  const server = http.createServer(app);

  // ── Security Middleware ──────────────────────────────────────  
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "wss:", "https:"],
      },
    },
  }));

  // CORS configuration for single URL
  const allowedOrigins = process.env.NODE_ENV === 'production'
    ? [process.env.FRONTEND_URL || 'https://wilyer-dashboard.onrender.com']
    : ['http://localhost:5173', 'http://localhost:3000'];

  app.use(cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Org-Slug', 'X-Device-ID', 'X-API-Key']
  }));

  // ── Body Parsers ─────────────────────────────────────────────
  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ extended: true, limit: '100mb' }));

  // ── Rate Limiting Configuration ──────────────────────────────
  class TieredRateLimiter {
    constructor() {
      this.stores = new Map();
      this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
    }

    getStore(key) {
      if (!this.stores.has(key)) {
        this.stores.set(key, new Map());
      }
      return this.stores.get(key);
    }

    increment(key, tier, windowMs) {
      const store = this.getStore(tier);
      const now = Date.now();
      const record = store.get(key) || { count: 0, resetTime: now + windowMs };
      
      if (now > record.resetTime) {
        record.count = 1;
        record.resetTime = now + windowMs;
      } else {
        record.count++;
      }
      
      store.set(key, record);
      return record;
    }

    cleanup() {
      const now = Date.now();
      for (const [tier, store] of this.stores) {
        for (const [key, record] of store) {
          if (now > record.resetTime) {
            store.delete(key);
          }
        }
        if (store.size === 0) {
          this.stores.delete(tier);
        }
      }
    }

    getRemainingTime(key, tier) {
      const store = this.getStore(tier);
      const record = store.get(key);
      return record ? Math.max(0, record.resetTime - Date.now()) : 0;
    }
  }

  const rateLimiter = new TieredRateLimiter();

  // Custom rate limiter middleware
  const createRateLimiter = (options) => {
    return (req, res, next) => {
      if (options.skip?.(req)) {
        return next();
      }

      let key;
      if (options.keyGenerator) {
        key = options.keyGenerator(req);
      } else {
        key = req.ip;
      }

      const tierKey = `${options.tier}:${key}`;
      
      const record = rateLimiter.increment(tierKey, options.tier, options.windowMs);
      
      const remaining = Math.max(0, options.max - record.count);
      const resetTime = record.resetTime;

      res.setHeader('X-RateLimit-Limit', options.max);
      res.setHeader('X-RateLimit-Remaining', remaining);
      res.setHeader('X-RateLimit-Reset', Math.ceil(resetTime / 1000));

      if (record.count > options.max) {
        const retryAfter = Math.ceil((resetTime - Date.now()) / 1000);
        res.setHeader('Retry-After', retryAfter);
        
        logger.warn(`Rate limit exceeded for ${key} on ${req.path} (${options.tier})`);
        
        return res.status(429).json({
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: options.message || 'Too many requests, please try again later.',
            retryAfter,
            limit: options.max,
            tier: options.tier
          }
        });
      }

      next();
    };
  };

  // Rate limiters configuration
  const rateLimiters = {
    global: createRateLimiter({
      windowMs: 60 * 1000,
      max: 10000,
      tier: 'global',
      message: 'Global rate limit exceeded',
      skip: (req) => req.path === '/health' || req.path === '/metrics'
    }),

    user: createRateLimiter({
      windowMs: 60 * 1000,
      max: 5000,
      tier: 'user',
      keyGenerator: (req) => req.user?.id ? `user:${req.user.id}` : req.ip,
      message: 'User rate limit exceeded'
    }),

    organization: createRateLimiter({
      windowMs: 60 * 1000,
      max: 50000,
      tier: 'org',
      keyGenerator: (req) => req.org?.id ? `org:${req.org.id}` : req.ip,
      message: 'Organization rate limit exceeded'
    }),

    device: createRateLimiter({
      windowMs: 60 * 1000,
      max: 600,
      tier: 'device',
      keyGenerator: (req) => {
        const deviceId = req.headers['x-device-id'] || req.body?.deviceId || req.params?.deviceId;
        return deviceId ? `device:${deviceId}` : req.ip;
      },
      message: 'Device rate limit exceeded'
    }),

    auth: createRateLimiter({
      windowMs: 15 * 60 * 1000,
      max: 100,
      tier: 'auth',
      keyGenerator: (req) => {
        if (req.body?.email) {
          return `auth:${req.body.email}`;
        }
        return `auth:${req.ip}`;
      },
      message: 'Too many authentication attempts'
    }),

    upload: createRateLimiter({
      windowMs: 60 * 60 * 1000,
      max: 1000,
      tier: 'upload',
      keyGenerator: (req) => req.user?.id ? `upload:${req.user.id}` : req.ip,
      message: 'Upload limit exceeded'
    }),

    playlist: createRateLimiter({
      windowMs: 60 * 1000,
      max: 2000,
      tier: 'playlist',
      keyGenerator: (req) => req.user?.id ? `playlist:${req.user.id}` : req.ip,
      message: 'Playlist operation limit exceeded'
    }),

    analytics: createRateLimiter({
      windowMs: 60 * 1000,
      max: 1000,
      tier: 'analytics',
      keyGenerator: (req) => req.user?.id ? `analytics:${req.user.id}` : req.ip,
      message: 'Analytics query limit exceeded'
    }),

    apiKey: createRateLimiter({
      windowMs: 60 * 1000,
      max: 10000,
      tier: 'apikey',
      keyGenerator: (req) => req.headers['x-api-key'] ? `apikey:${req.headers['x-api-key']}` : req.ip,
      message: 'API key rate limit exceeded'
    })
  };

  // Apply rate limiters
  app.use('/api/auth', rateLimiters.auth);
  app.use('/api/media/upload', rateLimiters.upload);
  app.use('/api/analytics', rateLimiters.analytics);
  app.use('/api/playlists', rateLimiters.playlist);
  
  app.use('/api/devices', (req, res, next) => {
    if (req.headers['x-device-id'] || req.body?.deviceId || req.params?.deviceId) {
      return rateLimiters.device(req, res, next);
    }
    next();
  });

  app.use('/api', (req, res, next) => {
    if (req.org?.id) {
      return rateLimiters.organization(req, res, next);
    }
    next();
  });

  app.use('/api', (req, res, next) => {
    if (req.user?.id) {
      return rateLimiters.user(req, res, next);
    }
    next();
  });

  app.use('/api', (req, res, next) => {
    if (req.headers['x-api-key']) {
      return rateLimiters.apiKey(req, res, next);
    }
    next();
  });

  app.use('/api', rateLimiters.global);

  // ── Performance Monitoring ───────────────────────────────────
  app.use((req, res, next) => {
    req.startTime = process.hrtime();
    
    res.on('finish', () => {
      const diff = process.hrtime(req.startTime);
      const time = diff[0] * 1e3 + diff[1] * 1e-6;
      
      if (time > 5000) {
        logger.warn({
          message: 'Slow request detected',
          method: req.method,
          path: req.path,
          time: `${time.toFixed(2)}ms`,
          status: res.statusCode,
          user: req.user?.id,
          org: req.org?.id
        });
      }
      
      if (global.requestCounts) {
        global.requestCounts.total++;
        if (time > 2000) global.requestCounts.slow++;
      }
    });
    
    next();
  });

  // ── Request Queue Monitoring ─────────────────────────────────
  global.requestCounts = { total: 0, slow: 0, errors: 0 };
  
  setInterval(() => {
    const counts = global.requestCounts;
    const errorRate = counts.total > 0 ? (counts.errors / counts.total * 100).toFixed(2) : 0;
    
    logger.info({
      message: 'Request statistics',
      total: counts.total,
      slow: counts.slow,
      errors: counts.errors,
      errorRate: `${errorRate}%`
    });
    
    global.requestCounts = { total: 0, slow: 0, errors: 0 };
  }, 60000);

  // ── Authentication middleware ────────────────────────────────
  app.use(async (req, res, next) => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      const orgSlug = req.headers['x-org-slug'];
      
      if (token) {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        const { pool } = require('./config/database');
        const result = await pool.query(
          `SELECT u.*, o.id as org_id, o.slug as org_slug 
           FROM wilyer_users u
           JOIN wilyer_organizations o ON o.id = u.org_id
           WHERE u.id = $1 AND u.is_active = true`,
          [decoded.userId]
        );
        
        if (result.rows.length > 0) {
          req.user = result.rows[0];
          req.org = { id: result.rows[0].org_id, slug: result.rows[0].org_slug };
        }
      } else if (orgSlug) {
        const { pool } = require('./config/database');
        const result = await pool.query(
          'SELECT id, slug FROM wilyer_organizations WHERE slug = $1 AND is_active = true',
          [orgSlug]
        );
        if (result.rows.length > 0) {
          req.org = result.rows[0];
        }
      }
      
      next();
    } catch (error) {
      next();
    }
  });

  // ── Logging ──────────────────────────────────────────────────
  if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('combined', {
      stream: { write: msg => logger.http(msg.trim()) },
      skip: (req) => req.path === '/health' || req.path === '/metrics'
    }));
  }

  // ── Health Check (internal only, not publicly accessible) ───
  app.get('/health', (req, res) => {
    // Only allow internal health checks
    if (req.ip === '::1' || req.ip === '127.0.0.1' || req.headers['x-forwarded-for'] === 'internal') {
      return res.json({
        status: 'ok',
        service: 'Aekads API',
        timestamp: new Date().toISOString()
      });
    }
    // For external requests, redirect to frontend
    res.redirect('/');
  });

  // ── Metrics endpoint (internal only) ─────────────────────────
  app.get('/metrics', (req, res) => {
    // Only allow internal metrics
    if (req.ip === '::1' || req.ip === '127.0.0.1' || req.headers['x-forwarded-for'] === 'internal') {
      return res.json({
        requests: global.requestCounts,
        stores: {
          size: rateLimiter.stores.size,
          totalKeys: Array.from(rateLimiter.stores.values()).reduce((acc, store) => acc + store.size, 0)
        }
      });
    }
    // For external requests, redirect to frontend
    res.redirect('/');
  });

  // ── API Routes ───────────────────────────────────────────────
  app.use('/api', routes);

  // ============== SERVE STATIC FRONTEND - PURE REACT APP ==============
  // This serves the React app at the root URL with NO backend endpoints visible
  
  if (process.env.NODE_ENV === 'production') {
    const fs = require('fs');
    
    // Find the frontend dist directory
    const possiblePaths = [
      path.join(__dirname, '../frontend/dist'),
      path.join(process.cwd(), 'frontend/dist'),
      '/opt/render/project/src/frontend/dist'
    ];
    
    let frontendDistPath = null;
    
    for (const testPath of possiblePaths) {
      if (fs.existsSync(testPath)) {
        frontendDistPath = testPath;
        logger.info(`✅ Found frontend build at: ${testPath}`);
        break;
      }
    }
    
    if (frontendDistPath) {
      // Serve static files
      app.use(express.static(frontendDistPath));
      
      // IMPORTANT: This must come AFTER API routes
      // For ANY route that's not /api, serve the React app
      app.get('*', (req, res, next) => {
        // Skip if it's an API route (these are handled above)
        if (req.path.startsWith('/api')) {
          return next();
        }
        
        // For all other routes, serve index.html
        // This includes /, /login, /dashboard, etc.
        const indexPath = path.join(frontendDistPath, 'index.html');
        
        if (fs.existsSync(indexPath)) {
          res.sendFile(indexPath);
        } else {
          logger.error(`index.html not found at ${indexPath}`);
          res.status(500).send('Frontend build is incomplete');
        }
      });
      
      logger.info(`✅ React app being served at root URL (/)`);
      logger.info(`✅ All frontend routes (/, /login, /dashboard, etc.) will show the React app`);
      logger.info(`✅ API available at /api/*`);
    } else {
      logger.error(`❌ Frontend build NOT found!`);
      
      // Fallback error message (should never happen in production)
      app.get('*', (req, res) => {
        res.status(500).send(`
          <html>
            <body style="font-family: sans-serif; background: #0a0a0a; color: #fff; display: flex; justify-content: center; align-items: center; height: 100vh;">
              <div style="text-align: center;">
                <h1>🚧 Build Error</h1>
                <p>Frontend build not found. Please check your build process.</p>
              </div>
            </body>
          </html>
        `);
      });
    }
  } else {
    // Development mode - redirect to Vite dev server
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) {
        return next();
      }
      res.redirect(`http://localhost:5173${req.path}`);
    });
  }
  // ============== END STATIC FRONTEND SERVING ==============

  // ── Error Handling ───────────────────────────────────────────
  app.use((err, req, res, next) => {
    global.requestCounts.errors++;
    next(err);
  });

  app.use(notFound);
  app.use(errorHandler);

  // ── Initialize Socket.io ─────────────────────────────────────
  initializeSocket(server);

  // ── Initialize Background Jobs ───────────────────────────────
  initializeJobs();

  // ── Start Server ─────────────────────────────────────────────
  const PORT = process.env.PORT || 5000;
  
  server.listen(PORT, '0.0.0.0', () => {
    logger.info(`🚀 Aekads running on port ${PORT}`);
    logger.info(`📍 Single URL: ${process.env.NODE_ENV === 'production' ? 'https://wilyer-dashboard.onrender.com' : `http://localhost:${PORT}`}`);
    logger.info(`📱 React app: / (root) - shows login page`);
    logger.info(`🔌 API: /api/*`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    cleanupStores();
    server.close(() => {
      process.exit(0);
    });
  });

  module.exports = { app, server };
}