async function create(client, reading) {
  const result = await client.query(
    `INSERT INTO lecturas (
       id_sensor,
       timestamp,
       valor_tension,
       valor_corriente,
       fase,
       rssi_lora,
       estado_conexion
     )
     VALUES ($1, COALESCE($2::timestamptz, now()), $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      reading.id_sensor,
      reading.timestamp || null,
      reading.valor_tension ?? null,
      reading.valor_corriente ?? null,
      reading.fase ?? null,
      reading.rssi_lora ?? null,
      reading.estado_conexion ?? null,
    ]
  );

  return result.rows[0];
}

module.exports = { create };
