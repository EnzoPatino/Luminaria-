require('dotenv').config();

const { runMaintenance } = require('../services/mantenimientoService');
const { closePool } = require('../config/database');

async function main() {
  const result = await runMaintenance();
  console.log('[DB] Mantenimiento finalizado:', result);
}

main()
  .catch((error) => {
    console.error('[DB] Error en mantenimiento:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
