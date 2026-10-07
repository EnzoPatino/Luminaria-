async function create(client, reading) {
  const result = await client.query(
    `INSERT INTO lecturas (
       id_sensor,
       id_tablero,
       timestamp,
       fecha_hora,
       valor_tension,
       valor_corriente,
       amperaje,
       fase,
       rssi_lora,
       estado_conexion
     )
     VALUES ($1, $2, COALESCE($3::timestamptz, now()), COALESCE($4::timestamptz, now()), $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      reading.id_sensor,
      reading.id_tablero || null,
      reading.timestamp || null,
      reading.fecha_hora || reading.timestamp || null,
      reading.valor_tension ?? null,
      reading.valor_corriente ?? null,
      reading.amperaje ?? reading.valor_corriente ?? null,
      reading.fase ?? null,
      reading.rssi_lora ?? null,
      reading.estado_conexion ?? null,
    ]
  );

  return result.rows[0];
}

module.exports = { create };
