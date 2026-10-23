const logger = require('../services/logger');

// ─────────────────────────────────────────────────────────────────────────────
// BE-09: Middleware que genera un correlation_id por cada petición HTTP.
// Este ID se propaga a los logs, audit_log y permite rastrear un request
// de punta a punta.
// ─────────────────────────────────────────────────────────────────────────────

function correlationMiddleware(req, res, next) {
  const suppliedId = req.headers['x-correlation-id'];
  req.correlationId = typeof suppliedId === 'string' && /^[a-zA-Z0-9._-]{1,80}$/.test(suppliedId)
    ? suppliedId
    : logger.generateCorrelationId();
  res.setHeader('X-Correlation-Id', req.correlationId);
  next();
}

module.exports = { correlationMiddleware };
