const crypto = require('crypto');
const usuariosModel = require('../models/usuariosModel');
const auditLogModel = require('../models/auditLogModel');

// ─────────────────────────────────────────────────────────────────────────────
// BE-04: Servicio de autenticación JWT usando crypto nativo de Node.js.
// Se usa HMAC-SHA256 para firmar tokens sin dependencias externas.
// ─────────────────────────────────────────────────────────────────────────────

const JWT_SECRET = process.env.JWT_SECRET || 'luminaria-dev-secret-change-in-production';
const JWT_EXPIRES_IN_SECONDS = Number(process.env.JWT_EXPIRES_IN_SECONDS) || 28800; // 8 horas

// ── Hashing de contraseñas con scrypt (nativo de Node.js) ───────────────────

function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(`${salt}:${derivedKey.toString('hex')}`);
    });
  });
}

function verifyPassword(password, storedHash) {
  return new Promise((resolve, reject) => {
    const [salt, hash] = storedHash.split(':');
    if (!salt || !hash) return resolve(false);
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(crypto.timingSafeEqual(Buffer.from(hash, 'hex'), derivedKey));
    });
  });
}

// ── JWT manual con HMAC-SHA256 (sin dependencias externas) ──────────────────

function base64UrlEncode(data) {
  return Buffer.from(data).toString('base64url');
}

function base64UrlDecode(str) {
  return Buffer.from(str, 'base64url').toString('utf8');
}

function signJwt(payload) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);

  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + JWT_EXPIRES_IN_SECONDS,
  };

  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(fullPayload));
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${headerB64}.${payloadB64}`)
    .digest('base64url');

  return `${headerB64}.${payloadB64}.${signature}`;
}

function verifyJwt(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signature] = parts;

    // Verificar firma
    const expectedSignature = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${headerB64}.${payloadB64}`)
      .digest('base64url');

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return null;
    }

    const payload = JSON.parse(base64UrlDecode(payloadB64));

    // Verificar expiración
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

// ── Operaciones de autenticación ────────────────────────────────────────────

async function login(email, password, ip) {
  const usuario = await usuariosModel.findByEmail(email);

  if (!usuario) {
    // Audit: intento de login fallido
    await auditLogModel.log({
      accion: 'LOGIN_FALLIDO',
      recurso: 'auth',
      ip_origen: ip,
      detalles: { email, razon: 'Usuario no encontrado' },
    });
    return null;
  }

  const passwordValid = await verifyPassword(password, usuario.password_hash);
  if (!passwordValid) {
    await auditLogModel.log({
      id_usuario: usuario.id_usuario,
      accion: 'LOGIN_FALLIDO',
      recurso: 'auth',
      ip_origen: ip,
      detalles: { email, razon: 'Contraseña incorrecta' },
    });
    return null;
  }

  const token = signJwt({
    sub: usuario.id_usuario,
    email: usuario.email,
    rol: usuario.rol,
    nombre: usuario.nombre,
  });

  // Audit: login exitoso
  await auditLogModel.log({
    id_usuario: usuario.id_usuario,
    accion: 'LOGIN_EXITOSO',
    recurso: 'auth',
    ip_origen: ip,
  });

  return {
    token,
    usuario: {
      id_usuario: usuario.id_usuario,
      nombre: usuario.nombre,
      email: usuario.email,
      rol: usuario.rol,
    },
  };
}

async function register(userData, ip) {
  const password_hash = await hashPassword(userData.password);

  const usuario = await usuariosModel.create({
    nombre: userData.nombre,
    email: userData.email,
    password_hash,
    rol: userData.rol || 'tecnico',
  });

  await auditLogModel.log({
    id_usuario: usuario.id_usuario,
    accion: 'REGISTRO_USUARIO',
    recurso: 'usuarios',
    id_recurso: String(usuario.id_usuario),
    ip_origen: ip,
    detalles: { rol: usuario.rol },
  });

  return usuario;
}

module.exports = {
  login,
  register,
  signJwt,
  verifyJwt,
  hashPassword,
  verifyPassword,
};
