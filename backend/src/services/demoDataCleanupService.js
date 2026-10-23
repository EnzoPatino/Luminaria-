const { pool } = require('../config/database');

const SELECT_STALE_DEMO_BOARDS = `
  SELECT t.id_tablero
  FROM tableros t
  WHERE left(t.id_tablero, 5) = 'DEMO_'
    AND t.ultima_modificacion < now() - ($1::double precision * interval '1 millisecond')
    AND NOT EXISTS (
      SELECT 1
      FROM lecturas l
      WHERE l.id_tablero = t.id_tablero
        AND l.timestamp >= now() - ($1::double precision * interval '1 millisecond')
    )
  ORDER BY t.id_tablero
  FOR UPDATE OF t SKIP LOCKED
`;

async function cleanupStaleDemoData(db = pool, inactivityTtlMs = 5 * 60 * 1000) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(SELECT_STALE_DEMO_BOARDS, [inactivityTtlMs]);
    const boardIds = result.rows.map((row) => row.id_tablero);

    if (boardIds.length === 0) {
      await client.query('COMMIT');
      return 0;
    }

    await client.query('DELETE FROM alertas WHERE id_tablero = ANY($1::text[])', [boardIds]);
    await client.query(
      `DELETE FROM lecturas
       WHERE id_tablero = ANY($1::text[])
          OR id_sensor IN (
            SELECT id_sensor FROM sensores WHERE id_tablero = ANY($1::text[])
          )`,
      [boardIds]
    );
    await client.query('DELETE FROM sensores WHERE id_tablero = ANY($1::text[])', [boardIds]);
    await client.query('DELETE FROM tableros WHERE id_tablero = ANY($1::text[])', [boardIds]);
    await client.query('COMMIT');
    return boardIds.length;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { cleanupStaleDemoData, SELECT_STALE_DEMO_BOARDS };
