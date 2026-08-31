async function getOrCreateSensorForTablero(client, idTablero) {
  const existing = await client.query(
    `SELECT *
     FROM sensores
     WHERE id_tablero = $1
     ORDER BY id_sensor ASC
     LIMIT 1`,
    [idTablero]
  );

  if (existing.rowCount > 0) {
    return existing.rows[0];
  }

  const created = await client.query(
    `INSERT INTO sensores (id_tablero)
     VALUES ($1)
     RETURNING *`,
    [idTablero]
  );

  return created.rows[0];
}

module.exports = { getOrCreateSensorForTablero };
