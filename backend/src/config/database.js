const { Pool } = require('pg');

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
  console.error('[DB] Error inesperado en un cliente inactivo:', error);
});

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
      console.error('[DB] Error durante ROLLBACK:', rollbackError);
    }
    throw error;
  } finally {
    client.release();
  }
}

async function closePool() {
  await pool.end();
}

module.exports = { pool, withTransaction, closePool };
