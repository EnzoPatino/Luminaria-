require('dotenv').config();

const fs = require('fs/promises');
const path = require('path');
const { pool, closePool } = require('../config/database');

async function main() {
  const seedsDir = path.join(__dirname, '..', 'db', 'seeds');
  const files = (await fs.readdir(seedsDir))
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const filePath = path.join(seedsDir, file);
    const sql = await fs.readFile(filePath, 'utf8');
    await pool.query(sql);
    console.log(`[DB] Seed ${file} ejecutado correctamente.`);
  }
}

main()
  .catch((error) => {
    console.error('[DB] Error en seed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
