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

  // ── Health Check ─────────────────────────────────────────────
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'Aekads API',
      version: '1.0.0',
      worker: process.pid,
      timestamp: new Date().toISOString(),
      stats: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage()
      }
    });
  });

  // ── Metrics endpoint ──────────────────────────────────────────
  app.get('/metrics', (req, res) => {
    res.json({
      requests: global.requestCounts,
      stores: {
        size: rateLimiter.stores.size,
        totalKeys: Array.from(rateLimiter.stores.values()).reduce((acc, store) => acc + store.size, 0)
      }
    });
  });

  // ── API Routes ───────────────────────────────────────────────
  app.use('/api', routes);

  // ============== SERVE STATIC FRONTEND - UPDATED ==============
  // Serve static files from frontend dist in production
  if (process.env.NODE_ENV === 'production') {
    // Path to frontend build folder based on your structure
    const frontendDistPath = path.join(__dirname, '../frontend/dist');
    
    // Log for debugging
    logger.info(`Looking for frontend build at: ${frontendDistPath}`);
    
    // Check if frontend dist exists
    const fs = require('fs');
    if (fs.existsSync(frontendDistPath)) {
      // Serve static files
      app.use(express.static(frontendDistPath));
      
      // For any non-API route, serve index.html
      app.get('*', (req, res, next) => {
        // Skip API routes
        if (req.path.startsWith('/api')) {
          return next();
        }
        
        // Skip health and metrics
        if (req.path === '/health' || req.path === '/metrics') {
          return next();
        }
        
        // IMPORTANT: Serve index.html for ALL frontend routes
        // This enables client-side routing (login, dashboard, etc.)
        res.sendFile(path.join(frontendDistPath, 'index.html'));
      });
      
      logger.info(`✅ Successfully serving frontend from: ${frontendDistPath}`);
      logger.info(`✅ Root path (/) will serve the React app which should redirect to /login`);
    } else {
      logger.error(`❌ Frontend build NOT found at: ${frontendDistPath}`);
      
      // Fallback - Show API info but with note about frontend
      app.get('/', (req, res) => {
        res.send(`
          <html>
            <head>
              <title>Aekads API</title>
              <style>
                body { font-family: sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
                .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                h1 { color: #333; }
                .error { color: #e74c3c; }
                .links { margin-top: 20px; }
                .links a { display: inline-block; margin: 0 10px; padding: 10px 20px; background: #3498db; color: white; text-decoration: none; border-radius: 5px; }
              </style>
            </head>
            <body>
              <div class="container">
                <h1>🚀 Aekads API</h1>
                <p class="error">⚠️ Frontend build not found</p>
                <p>Please build the frontend first:</p>
                <pre style="background: #f0f0f0; padding: 10px; border-radius: 5px;">cd frontend && npm run build</pre>
                <div class="links">
                  <a href="/api">API</a>
                  <a href="/health">Health Check</a>
                </div>
              </div>
            </body>
          </html>
        `);
      });
      
      // Also handle any other route to show the same message
      app.get('*', (req, res, next) => {
        if (req.path.startsWith('/api') || req.path === '/health' || req.path === '/metrics') {
          return next();
        }
        res.redirect('/');
      });
    }
  } else {
    // Development mode - minimal message with redirect hint
    app.get('/', (req, res) => {
      res.send(`
        <html>
          <head>
            <title>Aekads API (Dev)</title>
            <style>
              body { font-family: sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
              .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
              h1 { color: #333; }
              .note { color: #f39c12; }
              .links { margin-top: 20px; }
              .links a { display: inline-block; margin: 0 10px; padding: 10px 20px; background: #3498db; color: white; text-decoration: none; border-radius: 5px; }
              .frontend-link { background: #27ae60; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>🚀 Aekads API - Development Mode</h1>
              <p class="note">⚠️ This is the API server</p>
              <p>For the frontend application, please use:</p>
              <div class="links">
                <a href="http://localhost:5173" class="frontend-link" target="_blank">Frontend (Port 5173)</a>
                <a href="/api">API</a>
                <a href="/health">Health Check</a>
              </div>
              <p style="margin-top: 20px; font-size: 0.9em; color: #666;">
                In production, this page will automatically show the frontend application.
              </p>
            </div>
          </body>
        </html>
      `);
    });
    
    // In development, still handle other routes gracefully
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path === '/health' || req.path === '/metrics') {
        return next();
      }
      // Redirect to frontend dev server for non-API routes in development
      res.redirect('http://localhost:5173' + req.path);
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
    logger.info(`🚀 Aekads API running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
    logger.info(`📍 Single URL: ${process.env.NODE_ENV === 'production' ? 'https://wilyer-dashboard.onrender.com' : `http://localhost:${PORT}`}`);
    logger.info(`📚 API: /api`);
    logger.info(`❤️ Health: /health`);
    if (process.env.NODE_ENV === 'production') {
      logger.info(`✅ Frontend will be served at root path (/)`);
    } else {
      logger.info(`⚠️ Development mode - frontend runs on http://localhost:5173`);
    }
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