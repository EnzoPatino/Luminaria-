const { pool } = require('../config/database');

/**
 * Modelo de audit_log para registro de seguridad (SEC-03).
 */

async function log(entry) {
  const result = await pool.query(
    `INSERT INTO audit_log (id_usuario, accion, recurso, id_recurso, ip_origen, detalles, correlation_id)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
     RETURNING *`,
    [
      entry.id_usuario || null,
      entry.accion,
      entry.recurso,
      entry.id_recurso || null,
      entry.ip_origen || null,
      entry.detalles ? JSON.stringify(entry.detalles) : null,
      entry.correlation_id || null,
    ]
  );
  return result.rows[0];
}

async function findRecent(filters = {}) {
  const conditions = [];
  const values = [];

  if (filters.accion) {
    values.push(filters.accion);
    conditions.push(`accion = $${values.length}`);
  }
  if (filters.id_usuario) {
    values.push(filters.id_usuario);
    conditions.push(`id_usuario = $${values.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = Math.min(Math.max(Number(filters.limit) || 50, 1), 200);

  values.push(limit);

  const result = await pool.query(
    `SELECT al.*, u.nombre AS nombre_usuario, u.email AS email_usuario
     FROM audit_log al
     LEFT JOIN usuarios u ON u.id_usuario = al.id_usuario
     ${where}
     ORDER BY al.timestamp DESC
     LIMIT $${values.length}`,
    values
  );
  return result.rows;
}

module.exports = { log, findRecent };
