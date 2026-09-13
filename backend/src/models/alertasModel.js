async function create(client, alert) {
  const result = await client.query(
    `INSERT INTO alertas (
       id_tablero,
       id_lectura,
       tipo_alerta,
       id_foco_afectado,
       ubicacion,
       fecha_hora_generada,
       prioridad,
       estado_alerta,
       es_persistente,
       datos_json
     )
     VALUES (
       $1, $2, $3, $4, $5,
       COALESCE($6::timestamptz, now()),
       $7, 'activa', $8, $9::jsonb
     )
     RETURNING *`,
    [
      alert.id_tablero,
      alert.id_lectura ?? null,
      alert.tipo_alerta,
      alert.id_foco_afectado ?? null,
      alert.ubicacion ?? null,
      alert.fecha_hora_generada || null,
      alert.prioridad,
      alert.es_persistente,
      alert.datos_json == null ? null : JSON.stringify(alert.datos_json),
    ]
  );

  return result.rows[0];
}

async function resolve(client, idAlerta) {
  const result = await client.query(
    `UPDATE alertas
     SET estado_alerta = 'resuelta',
         fecha_resolucion = COALESCE(fecha_resolucion, now())
     WHERE id_alerta = $1
     RETURNING *`,
    [idAlerta]
  );

  return result.rows[0] || null;
}

/**
 * Lists persisted alerts newest first. Filters are parameterised to keep the
 * REST API safe from SQL injection and work with the hardware priority names.
 */
async function getAll(client, filters = {}) {
  const conditions = [];
  const values = [];

  const prioridad = filters.severidad || filters.prioridad;
  if (prioridad) {
    values.push(prioridad);
    conditions.push(`a.prioridad = $${values.length}`);
  }
  if (filters.estado_alerta) {
    values.push(filters.estado_alerta);
    conditions.push(`a.estado_alerta = $${values.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const countResult = await client.query(
    `SELECT COUNT(*)::int AS total FROM alertas a ${where}`,
    values
  );

  values.push(filters.limit || 100);
  const limitParam = `$${values.length}`;
  values.push(filters.offset || 0);
  const offsetParam = `$${values.length}`;

  const result = await client.query(
    `SELECT
       a.id_alerta,
       a.id_tablero,
       a.id_lectura,
       a.tipo_alerta,
       a.id_foco_afectado,
       a.ubicacion,
       a.fecha_hora_generada,
       a.prioridad,
       a.estado_alerta,
       a.fecha_resolucion,
       a.es_persistente,
       a.datos_json
     FROM alertas a
     ${where}
     ORDER BY a.fecha_hora_generada DESC, a.id_alerta DESC
     LIMIT ${limitParam} OFFSET ${offsetParam}`,
    values
  );

  return { rows: result.rows, total: countResult.rows[0].total };
}

module.exports = { create, getAll, resolve };
