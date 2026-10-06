const crypto = require('crypto');

// ─────────────────────────────────────────────────────────────────────────────
// BE-09: Logger estructurado con correlation_id para trazabilidad completa
// MQTT → Worker → BD. Sin dependencias externas (no necesitamos winston/pino
// para este proyecto escolar; lo implementamos directamente).
// ─────────────────────────────────────────────────────────────────────────────

const LOG_LEVEL_PRIORITY = { error: 0, warn: 1, info: 2, debug: 3 };
const CURRENT_LEVEL = LOG_LEVEL_PRIORITY[process.env.LOG_LEVEL || 'info'] ?? 2;

function shouldLog(level) {
  return (LOG_LEVEL_PRIORITY[level] ?? 2) <= CURRENT_LEVEL;
}

function formatLog(level, message, context = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  };

  // En producción emitir JSON puro; en desarrollo emitir texto legible
  if (process.env.NODE_ENV === 'production') {
    return JSON.stringify(entry);
  }

  const prefix = `[${entry.timestamp}] [${level.toUpperCase()}]`;
  const correlationTag = context.correlation_id ? ` [${context.correlation_id}]` : '';
  const contextStr = Object.keys(context).length > 0
    ? ` ${JSON.stringify(context)}`
    : '';
  return `${prefix}${correlationTag} ${message}${contextStr}`;
}

const logger = {
  error(message, context) {
    if (shouldLog('error')) console.error(formatLog('error', message, context));
  },
  warn(message, context) {
    if (shouldLog('warn')) console.warn(formatLog('warn', message, context));
  },
  info(message, context) {
    if (shouldLog('info')) console.log(formatLog('info', message, context));
  },
  debug(message, context) {
    if (shouldLog('debug')) console.log(formatLog('debug', message, context));
  },

  /**
   * Genera un ID de correlación único para rastrear un evento
   * desde su ingreso (MQTT o HTTP) hasta su persistencia en BD.
   */
  generateCorrelationId() {
    return crypto.randomUUID();
  },
};

module.exports = logger;
