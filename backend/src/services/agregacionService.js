const { pool } = require('../config/database');

async function aggregatePreviousDay() {
  const result = await pool.query(
    `INSERT INTO estadisticas_zona (
       id_zona,
       periodo_dia,
       tension_minima,
       tension_maxima,
       tension_promedio,
       cantidad_lecturas
     )
     SELECT
       t.id_zona,
       date_trunc('day', l.timestamp)::date AS periodo_dia,
       MIN(l.valor_tension) AS tension_minima,
       MAX(l.valor_tension) AS tension_maxima,
       AVG(l.valor_tension)::numeric(6,2) AS tension_promedio,
       COUNT(*)::integer AS cantidad_lecturas
     FROM lecturas l
     JOIN sensores s ON s.id_sensor = l.id_sensor
     JOIN tableros t ON t.id_tablero = s.id_tablero
     WHERE l.valor_tension IS NOT NULL
       AND t.id_zona IS NOT NULL
       AND date_trunc('day', l.timestamp)::date = CURRENT_DATE - 1
     GROUP BY t.id_zona, date_trunc('day', l.timestamp)::date
     ON CONFLICT (id_zona, periodo_dia) DO UPDATE SET
       tension_minima = EXCLUDED.tension_minima,
       tension_maxima = EXCLUDED.tension_maxima,
       tension_promedio = EXCLUDED.tension_promedio,
       cantidad_lecturas = EXCLUDED.cantidad_lecturas,
       fecha_calculo = now()
     RETURNING *`,
    []
  );

  return result.rows;
}

module.exports = { aggregatePreviousDay };
