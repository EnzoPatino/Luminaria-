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

module.exports = { create, resolve };
