const { verifyJwt } = require('../services/authService');

// ─────────────────────────────────────────────────────────────────────────────
// BE-04: Middleware de autenticación JWT y autorización RBAC.
// Se usa en las rutas que requieren protección (ej. resolver alertas).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Middleware que exige un JWT válido en el header Authorization.
 * Inyecta `req.user` con los datos del token decodificado.
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      status: 'error',
      statusCode: 401,
      message: 'Token de autenticación requerido. Envíe un header Authorization: Bearer <token>.',
    });
  }

  const token = authHeader.slice(7);
  const payload = verifyJwt(token);

  if (!payload) {
    return res.status(401).json({
      status: 'error',
      statusCode: 401,
      message: 'Token inválido o expirado.',
    });
  }

  req.user = {
    id_usuario: payload.sub,
    email: payload.email,
    rol: payload.rol,
    nombre: payload.nombre,
  };

  next();
}

/**
 * Middleware factory que restringe el acceso a roles específicos.
 * Uso: `requireRole('admin', 'tecnico')`
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        status: 'error',
        statusCode: 401,
        message: 'Debe autenticarse primero.',
      });
    }

    if (!roles.includes(req.user.rol)) {
      return res.status(403).json({
        status: 'error',
        statusCode: 403,
        message: `Acceso denegado. Se requiere rol: ${roles.join(' o ')}.`,
      });
    }

    next();
  };
}

/**
 * Middleware opcional: si hay token lo valida e inyecta req.user,
 * pero no bloquea si no hay token. Útil para rutas que funcionan
 * con o sin autenticación.
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const payload = verifyJwt(token);
    if (payload) {
      req.user = {
        id_usuario: payload.sub,
        email: payload.email,
        rol: payload.rol,
        nombre: payload.nombre,
      };
    }
  }

  next();
}

module.exports = { requireAuth, requireRole, optionalAuth };
