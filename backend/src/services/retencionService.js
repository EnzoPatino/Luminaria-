const { withTransaction } = require('../config/database');

async function purgeExpiredData() {
  return withTransaction(async (client) => {
    // Primero se eliminan alertas vencidas. Las persistentes duran 6 meses;
    // las demás, 1 mes.
    const alertas = await client.query(
      `DELETE FROM alertas
       WHERE (es_persistente = FALSE AND fecha_hora_generada < now() - INTERVAL '1 month')
          OR (es_persistente = TRUE  AND fecha_hora_generada < now() - INTERVAL '6 months')
       RETURNING id_alerta`,
      []
    );

    // Después se eliminan lecturas de más de un mes que ya no tengan ninguna
    // alerta que dependa de ellas. NOT EXISTS evita problemas de NULL que
    // puede introducir NOT IN y mantiene la relación funcional.
    const lecturas = await client.query(
      `DELETE FROM lecturas l
       WHERE l.timestamp < now() - INTERVAL '1 month'
         AND NOT EXISTS (
           SELECT 1
           FROM alertas a
           WHERE a.id_lectura = l.id_lectura
         )
       RETURNING l.id_lectura`,
      []
    );

    return {
      alertasEliminadas: alertas.rowCount,
      lecturasEliminadas: lecturas.rowCount,
    };
  });
}

module.exports = { purgeExpiredData };
