const config = require('../config');
const { cleanupStaleDemoData } = require('./demoDataCleanupService');

let timer = null;
let running = null;

function runCleanupSafely() {
  if (running) return running;

  running = cleanupStaleDemoData(undefined, config.demoData.inactivityTtlMs)
    .then((deletedCount) => {
      if (deletedCount > 0) {
        console.log(`[DEMO] Eliminados ${deletedCount} tableros inactivos y sus datos.`);
      }
      return deletedCount;
    })
    .catch((error) => {
      console.error('[DEMO] Error limpiando datos de prueba:', error.message);
      return 0;
    })
    .finally(() => {
      running = null;
    });

  return running;
}

function startDemoDataCleanupScheduler() {
  if (timer) return timer;

  runCleanupSafely();
  timer = setInterval(runCleanupSafely, config.demoData.cleanupIntervalMs);
  timer.unref?.();
  return timer;
}

async function stopDemoDataCleanupScheduler() {
  if (timer) clearInterval(timer);
  timer = null;
  if (running) await running;
}

module.exports = { startDemoDataCleanupScheduler, stopDemoDataCleanupScheduler };
