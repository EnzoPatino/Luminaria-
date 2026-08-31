async function upsertFromEvent(client, event) {
  const idTablero = String(event.id_tablero).trim();
  const ubicacion = event.ubicacion ? String(event.ubicacion) : null;
  const data = event.datos && typeof event.datos === 'object' ? event.datos : {};
  const fase = data.fase ? String(data.fase) : null;
  const tensionNominal = Number.isFinite(Number(data.tension_nominal_v))
    ? Number(data.tension_nominal_v)
    : 220.0;

  const result = await client.query(
    `INSERT INTO tableros
      (id_tablero, nombre_tablero, ubicacion, fase, tension_nominal)
     VALUES ($1, $1, $2, $3, $4)
     ON CONFLICT (id_tablero) DO UPDATE SET
       nombre_tablero = COALESCE(tableros.nombre_tablero, EXCLUDED.nombre_tablero),
       ubicacion = COALESCE(EXCLUDED.ubicacion, tableros.ubicacion),
       fase = COALESCE(EXCLUDED.fase, tableros.fase),
       tension_nominal = COALESCE(EXCLUDED.tension_nominal, tableros.tension_nominal)
     RETURNING *`,
    [idTablero, ubicacion, fase, tensionNominal]
  );

  return result.rows[0];
}

async function updateDerivedState(client, idTablero) {
  const result = await client.query(
    `UPDATE tableros t
     SET estado = CASE
       WHEN EXISTS (
         SELECT 1 FROM alertas a
         WHERE a.id_tablero = t.id_tablero
           AND a.estado_alerta = 'activa'
           AND a.prioridad = 'CRITICA'
       ) THEN 'critico'
       WHEN EXISTS (
         SELECT 1 FROM alertas a
         WHERE a.id_tablero = t.id_tablero
           AND a.estado_alerta = 'activa'
           AND a.prioridad = 'ADVERTENCIA'
       ) THEN 'advertencia'
       WHEN latest.valor_tension < 190.0 THEN 'critico'
       WHEN latest.valor_tension < 210.0 THEN 'advertencia'
       ELSE 'ok'
     END
     FROM (
       SELECT s.id_tablero, l.valor_tension
       FROM sensores s
       JOIN lecturas l ON l.id_sensor = s.id_sensor
       WHERE s.id_tablero = $1
       ORDER BY l.timestamp DESC
       LIMIT 1
     ) latest
     WHERE t.id_tablero = $1
     RETURNING t.*`,
    [idTablero]
  );

  // No latest telemetry: derive only from active alerts and default to ok.
  if (result.rowCount === 0) {
    return client.query(
      `UPDATE tableros t
       SET estado = CASE
         WHEN EXISTS (
           SELECT 1 FROM alertas a
           WHERE a.id_tablero = t.id_tablero
             AND a.estado_alerta = 'activa'
             AND a.prioridad = 'CRITICA'
         ) THEN 'critico'
         WHEN EXISTS (
           SELECT 1 FROM alertas a
           WHERE a.id_tablero = t.id_tablero
             AND a.estado_alerta = 'activa'
             AND a.prioridad = 'ADVERTENCIA'
         ) THEN 'advertencia'
         ELSE 'ok'
       END
       WHERE t.id_tablero = $1
       RETURNING t.*`,
      [idTablero]
    ).then((r) => r.rows[0] || null);
  }

  return result.rows[0];
}

module.exports = { upsertFromEvent, updateDerivedState };
