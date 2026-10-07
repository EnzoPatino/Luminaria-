require('dotenv').config();

const fs = require('fs/promises');
const path = require('path');
const { pool, closePool } = require('../config/database');

async function main() {
  const migrationsDir = path.join(__dirname, '..', 'db', 'migrations');
  const files = (await fs.readdir(migrationsDir))
    .filter((file) => /^\d+_.+\.sql$/.test(file))
    .sort();

  for (const file of files) {
    const sql = await fs.readFile(path.join(migrationsDir, file), 'utf8');
    await pool.query(sql);
    console.log(`[DB] Migración ${file} ejecutada correctamente.`);
  }
}

main()
  .catch((error) => {
    console.error('[DB] Error en migración:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
