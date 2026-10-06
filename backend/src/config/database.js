const { Pool } = require('pg');
const logger = require('../services/logger');

// ─────────────────────────────────────────────────────────────────────────────
// BE-07: Connection Pooling con Retry y Backoff Exponencial para PostgreSQL.
// Si la BD se cae, el pool reintenta la conexión automáticamente con backoff
// en vez de fallar de inmediato y tumbar el servidor.
// ─────────────────────────────────────────────────────────────────────────────

const poolConfig = {
  max: Number(process.env.PGPOOL_MAX || 10),
  idleTimeoutMillis: Number(process.env.PGIDLE_TIMEOUT_MS || 10000),
  connectionTimeoutMillis: Number(process.env.PGCONNECT_TIMEOUT_MS || 5000),
};

if (process.env.DATABASE_URL) {
  poolConfig.connectionString = process.env.DATABASE_URL;
  if (process.env.NODE_ENV === 'production') {
    poolConfig.ssl = { rejectUnauthorized: false };
  }
} else {
  poolConfig.host = process.env.PGHOST || 'localhost';
  poolConfig.port = Number(process.env.PGPORT || 5432);
  poolConfig.database = process.env.PGDATABASE || 'luminaria';
  poolConfig.user = process.env.PGUSER || 'luminaria';
  poolConfig.password = process.env.PGPASSWORD || 'luminaria_dev';
}

const pool = new Pool(poolConfig);

pool.on('error', (error) => {
  logger.error('Error inesperado en un cliente inactivo del pool PostgreSQL.', {
    message: error.message,
    code: error.code,
  });
});

// ── BE-07: Retry con backoff exponencial ────────────────────────────────────

const RETRY_CONFIG = {
  maxRetries: Number(process.env.DB_MAX_RETRIES || 3),
  baseDelayMs: Number(process.env.DB_RETRY_BASE_DELAY_MS || 500),
  maxDelayMs: Number(process.env.DB_RETRY_MAX_DELAY_MS || 5000),
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableError(error) {
  // Errores de conexión, timeout, o base de datos no disponible
  const retryableCodes = new Set([
    'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EPIPE',
    'ENOTFOUND', 'EAI_AGAIN',
    '57P01',  // admin_shutdown
    '57P03',  // cannot_connect_now
    '53300',  // too_many_connections
    '08000',  // connection_exception
    '08003',  // connection_does_not_exist
    '08006',  // connection_failure
  ]);

  return retryableCodes.has(error.code) || error.message?.includes('Connection terminated');
}

/**
 * Ejecuta una query con retry automático usando backoff exponencial.
 * Ideal para operaciones que no están dentro de una transacción.
 */
async function queryWithRetry(text, params) {
  let lastError;

  for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
    try {
      return await pool.query(text, params);
    } catch (error) {
      lastError = error;

      if (attempt < RETRY_CONFIG.maxRetries && isRetryableError(error)) {
        const delay = Math.min(
          RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt),
          RETRY_CONFIG.maxDelayMs
        );
        const jitter = Math.floor(Math.random() * delay * 0.3);

        logger.warn(`Reintentando query PostgreSQL (intento ${attempt + 1}/${RETRY_CONFIG.maxRetries})`, {
          delay_ms: delay + jitter,
          error_code: error.code,
          error_message: error.message,
        });

        await sleep(delay + jitter);
      } else {
        throw error;
      }
    }
  }

  throw lastError;
}

async function withTransaction(work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      logger.error('Error durante ROLLBACK PostgreSQL.', {
        message: rollbackError.message,
      });
    }
    throw error;
  } finally {
    client.release();
  }
}

async function closePool() {
  await pool.end();
}

module.exports = { pool, queryWithRetry, withTransaction, closePool };
