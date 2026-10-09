require('dotenv').config();

const { pool, closePool } = require('../config/database');
const { hashPassword } = require('../services/authService');

const LEGACY_ACCOUNTS = ['admin', 'tecnico'];

function required(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`${name} es obligatorio para inicializar la cuenta administradora.`);
  return value;
}

function validatePassword(password) {
  if (password.length < 14 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
    throw new Error('BOOTSTRAP_ADMIN_PASSWORD debe tener al menos 14 caracteres e incluir mayúscula, minúscula y número.');
  }
}

async function main() {
  const username = required('BOOTSTRAP_ADMIN_USERNAME');
  const password = required('BOOTSTRAP_ADMIN_PASSWORD');
  const name = required('BOOTSTRAP_ADMIN_NAME');
  const email = required('BOOTSTRAP_ADMIN_EMAIL');
  if (LEGACY_ACCOUNTS.includes(username)) {
    throw new Error('BOOTSTRAP_ADMIN_USERNAME no puede ser "admin" ni "tecnico"; elegí un usuario nuevo.');
  }
  validatePassword(password);

  const existing = await pool.query('SELECT id FROM admin WHERE usuario = $1 LIMIT 1', [username]);
  if (existing.rowCount === 0) {
    const passwordHash = await hashPassword(password);
    await pool.query(
      `INSERT INTO admin (nombre, apellido, usuario, contraseña, dni, email, activo)
       VALUES ($1, '', $2, $3, $4, $5, TRUE)`,
      [name, username, passwordHash, `bootstrap-${username}`, email]
    );
    console.log(`[DB] Administrador inicial "${username}" creado.`);
  } else {
    console.log(`[DB] El administrador "${username}" ya existe; no se modificó.`);
  }

  // Solo desactiva las cuentas históricas conocidas, nunca la cuenta indicada.
  const legacyToDisable = LEGACY_ACCOUNTS.filter((account) => account !== username);
  if (legacyToDisable.length) {
    await pool.query('UPDATE admin SET activo = FALSE WHERE usuario = ANY($1::text[])', [legacyToDisable]);
    await pool.query('UPDATE tecnico SET activo = FALSE WHERE usuario = ANY($1::text[])', [legacyToDisable]);
  }
}

main()
  .catch((error) => { console.error(`[DB] No se pudo inicializar el administrador: ${error.message}`); process.exitCode = 1; })
  .finally(async () => { await closePool(); });
