// src/config/database.js
const { Pool } = require('pg');
const logger = require('../utils/logger');

// Parse DATABASE_URL if it exists, otherwise use individual environment variables
let poolConfig;

if (process.env.DATABASE_URL) {
  // Use the connection string directly
  poolConfig = {
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false // Required for Render PostgreSQL
    },
    max: 30,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000 
  };
} else {
  // Fallback to individual connection parameters
  poolConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || '',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    max: 30,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
  };
}

const pool = new Pool(poolConfig);

pool.on('connect', () => {
  logger.debug('New DB client connected');
});

pool.on('error', (err) => {
  logger.error('Unexpected DB pool error', { error: err.message });
});

// Test connection on startup
pool.query('SELECT NOW()')
  .then(() => logger.info('✅ PostgreSQL connected'))
  .catch(err => {
    logger.error('❌ PostgreSQL connection failed', { error: err.message });
    process.exit(1);
  });

/**
 * Execute a query with optional client (for transactions)
 */
const query = async (text, params, client) => {
  const start = Date.now();
  const conn = client || pool;
  try {
    const result = await conn.query(text, params);
    const duration = Date.now() - start;
    if (duration > 1000) {
      logger.warn('Slow query detected', { duration, query: text.substring(0, 100) });
    }
    return result;
  } catch (err) {
    logger.error('Query error', { error: err.message, query: text.substring(0, 200) });
    throw err;
  }
};

/**
 * Run multiple queries in a transaction
 */
const transaction = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

module.exports = { pool, query, transaction };