const { runMaintenance } = require('./mantenimientoService');

let timer = null;

function startMaintenanceScheduler() {
  if (timer) return timer;

  const interval = Number(process.env.MANTENIMIENTO_INTERVAL_MS || 86400000);
  if (!Number.isFinite(interval) || interval < 60000) {
    throw new Error('MANTENIMIENTO_INTERVAL_MS debe ser un número >= 60000.');
  }

  timer = setInterval(async () => {
    try {
      const result = await runMaintenance();
      console.log('[DB] Mantenimiento ejecutado:', result);
    } catch (error) {
      console.error('[DB] Error durante mantenimiento:', error);
    }
  }, interval);

  timer.unref?.();
  return timer;
}

function stopMaintenanceScheduler() {
  if (timer) clearInterval(timer);
  timer = null;
}

module.exports = { startMaintenanceScheduler, stopMaintenanceScheduler };
