const { pool } = require('../config/database');

/**
 * Modelo de usuarios para autenticación y RBAC (BE-04).
 */

async function findByEmail(email) {
  const result = await pool.query(
    'SELECT * FROM usuarios WHERE email = $1 AND activo = TRUE',
    [email]
  );
  return result.rows[0] || null;
}

async function findById(id) {
  const result = await pool.query(
    'SELECT id_usuario, nombre, email, rol, activo, created_at, updated_at FROM usuarios WHERE id_usuario = $1',
    [id]
  );
  return result.rows[0] || null;
}

async function create(userData) {
  const result = await pool.query(
    `INSERT INTO usuarios (nombre, email, password_hash, rol)
     VALUES ($1, $2, $3, $4)
     RETURNING id_usuario, nombre, email, rol, activo, created_at`,
    [userData.nombre, userData.email, userData.password_hash, userData.rol || 'tecnico']
  );
  return result.rows[0];
}

async function findAll(filters = {}) {
  const conditions = [];
  const values = [];

  if (filters.rol) {
    values.push(filters.rol);
    conditions.push(`rol = $${values.length}`);
  }
  if (filters.activo !== undefined) {
    values.push(filters.activo);
    conditions.push(`activo = $${values.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await pool.query(
    `SELECT id_usuario, nombre, email, rol, activo, created_at, updated_at
     FROM usuarios ${where}
     ORDER BY id_usuario ASC`,
    values
  );
  return result.rows;
}

module.exports = { findByEmail, findById, create, findAll };
