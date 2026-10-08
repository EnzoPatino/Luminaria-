const { pool } = require('../config/database');

/**
 * Modelo para la recuperación de datos históricos de telemetría (BE-05).
 */

async function getHistorico({ id_sensor, id_tablero, inicio, fin, limit, offset }) {
  const conditions = [];
  const values = [];

  if (id_sensor) {
    values.push(id_sensor);
    conditions.push(`id_sensor = $${values.length}`);
  }

  if (id_tablero) {
    values.push(id_tablero);
    conditions.push(`id_tablero = $${values.length}`);
  }

  if (inicio) {
    values.push(inicio);
    conditions.push(`timestamp >= $${values.length}`);
  }

  if (fin) {
    values.push(fin);
    conditions.push(`timestamp <= $${values.length}`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  // 1. Obtener el total de registros para la paginación
  const countResult = await pool.query(
    `SELECT COUNT(*) as total FROM lecturas ${whereClause}`,
    values
  );
  const total = parseInt(countResult.rows[0].total, 10);

  // 2. Obtener los datos paginados
  const dataValues = [...values];
  dataValues.push(limit);
  dataValues.push(offset);

  const dataResult = await pool.query(
    `SELECT
       id_lectura, id_sensor, timestamp, valor_tension,
       valor_corriente, fase, rssi_lora, estado_conexion
     FROM lecturas
     ${whereClause}
     ORDER BY timestamp DESC
     LIMIT $${dataValues.length - 1} OFFSET $${dataValues.length}`,
    dataValues
  );

  return {
    data: dataResult.rows,
    total,
  };
}

module.exports = { getHistorico };
