const { aggregatePreviousDay } = require('./agregacionService');
const { purgeExpiredData } = require('./retencionService');

async function runMaintenance() {
  // Agregar antes de purgar deja primero disponibles las lecturas que
  // todavía están dentro de la ventana de retención.
  const estadisticas = await aggregatePreviousDay();
  const purga = await purgeExpiredData();

  return {
    estadisticasGeneradas: estadisticas.length,
    ...purga,
  };
}

module.exports = { runMaintenance };
