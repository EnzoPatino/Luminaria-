const { pool } = require('../config/database');

/**
 * Modelo de usuarios adaptado al DER (entidades ADMIN y TECNICO).
 * Consulta la vista unificada `usuarios` o inserta directamente en las tablas `admin` o `tecnico`.
 */

async function findByEmail(identifier) {
  // Permite buscar tanto por email como por nombre de usuario (DER)
  const result = await pool.query(
    'SELECT * FROM usuarios WHERE (email = $1 OR usuario = $1) AND activo = TRUE LIMIT 1',
    [identifier]
  );
  return result.rows[0] || null;
}

async function findById(id) {
  const result = await pool.query(
    'SELECT * FROM usuarios WHERE (id = $1 OR id_usuario = $1) LIMIT 1',
    [id]
  );
  return result.rows[0] || null;
}

async function create(userData) {
  const rol = (userData.rol || 'tecnico').toLowerCase();
  const nombre = userData.nombre || userData.nom || 'Usuario';
  const apellido = userData.apellido || '';
  const usuario = userData.usuario || userData.email.split('@')[0];
  const email = userData.email;
  const passwordHash = userData.password_hash || userData.contraseña;
  const dni = userData.dni || `${Date.now()}`.slice(-8);
  const telefono = userData.telefono || null;

  if (rol === 'admin') {
    const result = await pool.query(
      `INSERT INTO admin (nombre, apellido, usuario, contraseña, dni, telefono, email)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, nombre, apellido, usuario, email, dni, telefono, 'admin' AS rol, activo, created_at`,
      [nombre, apellido, usuario, passwordHash, dni, telefono, email]
    );
    const adminCreated = result.rows[0];
    adminCreated.id_usuario = adminCreated.id;
    return adminCreated;
  }

  // Por defecto, se crea en la tabla TECNICO (según DER)
  const result = await pool.query(
    `INSERT INTO tecnico (nom, apellido, dni, telefono, email, usuario, contraseña)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, nom AS nombre, apellido, usuario, email, dni, telefono, 'tecnico' AS rol, activo, created_at`,
    [nombre, apellido, dni, telefono, email, usuario, passwordHash]
  );
  const tecnicoCreated = result.rows[0];
  tecnicoCreated.id_usuario = tecnicoCreated.id;

  // Si se proveyó el id del admin que lo gestiona, vincular en admin_tecnico
  if (userData.id_admin) {
    try {
      await pool.query(
        'INSERT INTO admin_tecnico (id_admin, id_tecnico) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [userData.id_admin, tecnicoCreated.id]
      );
    } catch (_) {}
  }

  return tecnicoCreated;
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
    `SELECT * FROM usuarios ${where} ORDER BY id_usuario ASC`,
    values
  );
  return result.rows;
}

module.exports = { findByEmail, findById, create, findAll };
