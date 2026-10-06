const auditLogModel = require('../models/auditLogModel');

// ─────────────────────────────────────────────────────────────────────────────
// SEC-03: Middleware de auditoría para endpoints sensibles.
// Registra la acción en la tabla audit_log después de que el controller
// haya respondido exitosamente.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Factory de middleware de auditoría.
 * @param {string} accion - Nombre de la acción (ej. 'RESOLVER_ALERTA')
 * @param {string} recurso - Nombre del recurso (ej. 'alertas')
 * @param {function} [extractId] - Función que recibe `req` y devuelve el ID del recurso afectado.
 */
function audit(accion, recurso, extractId) {
  return (req, res, next) => {
    const originalJson = res.json.bind(res);

    res.json = function (body) {
      // Solo auditar respuestas exitosas (2xx)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const idRecurso = typeof extractId === 'function' ? extractId(req) : null;

        // Fire-and-forget: no bloquear la respuesta por el audit log
        auditLogModel.log({
          id_usuario: req.user ? req.user.id_usuario : null,
          accion,
          recurso,
          id_recurso: idRecurso ? String(idRecurso) : null,
          ip_origen: req.ip,
          correlation_id: req.correlationId || null,
          detalles: {
            method: req.method,
            path: req.originalUrl,
            rol: req.user ? req.user.rol : 'anonymous',
          },
        }).catch((err) => {
          console.error('[Audit] Error registrando auditoría:', err.message);
        });
      }

      return originalJson(body);
    };

    next();
  };
}

module.exports = { audit };
