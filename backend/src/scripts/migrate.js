require('dotenv').config();

const fs = require('fs/promises');
const path = require('path');
const { pool, closePool } = require('../config/database');

async function main() {
  const file = path.join(__dirname, '..', 'db', 'migrations', '001_init_schema.sql');
  const sql = await fs.readFile(file, 'utf8');
  await pool.query(sql);
  console.log('[DB] Migración 001 ejecutada correctamente.');
}

main()
  .catch((error) => {
    console.error('[DB] Error en migración:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
