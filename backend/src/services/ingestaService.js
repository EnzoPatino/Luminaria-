const crypto = require('crypto');
const config = require('../config');
const { IngestionError } = require('../errors/ingestionError');
const { persistEvent } = require('./persistenciaService');
const { validateAndNormalizeEvent } = require('../validators/eventSchema');

const dedupeCache = new Map();
const tableroRateBuckets = new Map();

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => (
      `${JSON.stringify(key)}:${stableStringify(value[key])}`
    )).join(',')}}`;
  }

  return JSON.stringify(value);
}

function purgeExpiredDedupeEntries(now) {
  for (const [key, entry] of dedupeCache.entries()) {
    if (entry.expiresAt <= now) {
      dedupeCache.delete(key);
    }
  }
}

function buildDedupeKey(event) {
  return crypto
    .createHash('sha256')
    .update(stableStringify({
      tipo_evento: event.tipo_evento,
      id_tablero: event.id_tablero,
      timestamp: event.timestamp,
      severidad: event.severidad,
      ubicacion: event.ubicacion,
      datos: event.datos,
    }))
    .digest('hex');
}

function reserveDedupeSlot(event, now) {
  purgeExpiredDedupeEntries(now);

  const key = buildDedupeKey(event);
  const existing = dedupeCache.get(key);

  if (existing && existing.expiresAt > now) {
    return {
      duplicate: true,
      key,
      expiresAt: existing.expiresAt,
    };
  }

  // Seccion: reserva temprana para cortar reintentos simultaneos antes de tocar BD.
  dedupeCache.set(key, {
    state: 'processing',
    expiresAt: now + config.ingestion.deduplicationWindowMs,
  });

  return {
    duplicate: false,
    key,
    expiresAt: now + config.ingestion.deduplicationWindowMs,
  };
}

function confirmDedupeSlot(key) {
  const now = Date.now();
  dedupeCache.set(key, {
    state: 'persisted',
    expiresAt: now + config.ingestion.deduplicationWindowMs,
  });
}

function releaseDedupeSlot(key) {
  dedupeCache.delete(key);
}

function consumeTableroRateLimit(idTablero, now) {
  const windowMs = config.ingestion.rateLimitWindowMs;
  const max = config.ingestion.rateLimitMaxPerTablero;
  const current = tableroRateBuckets.get(idTablero);

  const bucket = current && now - current.windowStart < windowMs
    ? current
    : { windowStart: now, count: 0 };

  if (bucket.count >= max) {
    throw new IngestionError('Rate limit de ingesta excedido para el tablero.', {
      statusCode: 429,
      code: 'TABLERO_RATE_LIMIT_EXCEEDED',
      details: [{
        path: 'id_tablero',
        message: `El tablero ${idTablero} supero ${max} eventos en ${windowMs}ms.`,
      }],
    });
  }

  bucket.count += 1;
  tableroRateBuckets.set(idTablero, bucket);
}

async function ingestValidatedEvent(event, metadata = {}) {
  const now = Date.now();
  const reservation = reserveDedupeSlot(event, now);

  if (reservation.duplicate) {
    return {
      status: 'duplicate',
      duplicate: true,
      source: metadata.source || 'unknown',
      dedupeKey: reservation.key,
      event,
    };
  }

  try {
    // Seccion: integridad operacional por tablero antes de persistir.
    consumeTableroRateLimit(event.id_tablero, now);
    const data = await persistEvent(event);
    confirmDedupeSlot(reservation.key);

    return {
      status: 'persisted',
      duplicate: false,
      source: metadata.source || 'unknown',
      dedupeKey: reservation.key,
      event,
      data,
    };
  } catch (error) {
    releaseDedupeSlot(reservation.key);
    throw error;
  }
}

async function ingestEvent(rawEvent, metadata = {}) {
  // Seccion: schema estricto compartido por HTTP y MQTT.
  const event = validateAndNormalizeEvent(rawEvent);
  return ingestValidatedEvent(event, metadata);
}

module.exports = {
  ingestEvent,
  ingestValidatedEvent,
};
