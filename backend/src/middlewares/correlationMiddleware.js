const logger = require('../services/logger');

// ─────────────────────────────────────────────────────────────────────────────
// BE-09: Middleware que genera un correlation_id por cada petición HTTP.
// Este ID se propaga a los logs, audit_log y permite rastrear un request
// de punta a punta.
// ─────────────────────────────────────────────────────────────────────────────

function correlationMiddleware(req, res, next) {
  req.correlationId = req.headers['x-correlation-id'] || logger.generateCorrelationId();
  res.setHeader('X-Correlation-Id', req.correlationId);
  next();
}

module.exports = { correlationMiddleware };
