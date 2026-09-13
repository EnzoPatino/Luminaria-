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

/**
 * Returns the current, UI-ready state of every electrical board.  Focos are
 * inferred from the latest alert recorded for each id_foco_afectado because
 * the physical luminaires are reported by hardware events, not stored in a
 * separate table in the current schema.
 */
async function findAll(client) {
  const result = await client.query(
    `SELECT
       t.id_tablero,
       t.nombre_tablero,
       t.ubicacion,
       t.pos_x,
       t.pos_y,
       t.fase,
       t.tension_nominal,
       t.estado,
       latest.valor_tension AS tension_medida_v,
       COALESCE(focos.focos, '[]'::jsonb) AS focos
     FROM tableros t
     LEFT JOIN LATERAL (
       SELECT l.valor_tension
       FROM sensores s
       JOIN lecturas l ON l.id_sensor = s.id_sensor
       WHERE s.id_tablero = t.id_tablero
       ORDER BY l.timestamp DESC
       LIMIT 1
     ) latest ON TRUE
     LEFT JOIN LATERAL (
       SELECT jsonb_agg(
         jsonb_build_object(
           'id_foco', foco.id_foco,
           'corriente_medida_ma', foco.corriente_medida_ma,
           'estado', foco.estado
         ) ORDER BY foco.id_foco
       ) AS focos
       FROM (
         SELECT DISTINCT ON (a.id_foco_afectado)
           a.id_foco_afectado AS id_foco,
           COALESCE(
             NULLIF(a.datos_json ->> 'corriente_actual_ma', '')::numeric,
             NULLIF(a.datos_json ->> 'corriente_medida_ma', '')::numeric,
             0
           ) AS corriente_medida_ma,
           CASE
             WHEN a.estado_alerta = 'resuelta' THEN 'ok'
             WHEN a.tipo_alerta = 'DESCONEXION_ABRUPTA_FOCO' THEN 'robado'
             WHEN a.tipo_alerta = 'FOCO_QUEMADO' THEN 'quemado'
             ELSE 'ok'
           END AS estado
         FROM alertas a
         WHERE a.id_tablero = t.id_tablero
           AND a.id_foco_afectado IS NOT NULL
         ORDER BY a.id_foco_afectado, a.fecha_hora_generada DESC
       ) foco
     ) focos ON TRUE
     ORDER BY t.id_tablero ASC`
  );

  return result.rows;
}

module.exports = { upsertFromEvent, updateDerivedState, findAll };
