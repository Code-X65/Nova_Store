const { Pool } = require('pg');
const logger = require('../utils/logger');

const connectionString = process.env.DATABASE_URL;

const pgPool = new Pool({
  connectionString,
  max: 20, // Max connection pool size
  idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
  connectionTimeoutMillis: 2000, // Fail fast if database is unreachable (2 seconds)
  ssl: {
    rejectUnauthorized: false
  }
});

pgPool.on('error', (err) => {
  logger.error('Unexpected error on idle PostgreSQL client in pool:', err.message);
});

module.exports = pgPool;
