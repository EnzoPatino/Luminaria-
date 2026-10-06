const express = require('express');
const { pool } = require('../config/database');
const { checkSupabaseHealth } = require('../services/supabaseService');

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// BE-08: Health Check completo con estado de BD, MQTT y Circuit Breaker.
//
// El circuit breaker evita saturar la BD con SELECTs de health check cuando
// sabemos que está caída. Tras un número de fallos consecutivos, se marca
// como "open" y devuelve el último estado conocido sin consultar la BD.
// ─────────────────────────────────────────────────────────────────────────────

const circuitBreaker = {
  state: 'closed',       // 'closed' (normal) | 'open' (no consultar) | 'half-open' (probar)
  failureCount: 0,
  failureThreshold: 3,
  resetTimeoutMs: 30000,  // 30 segundos antes de reintentar
  lastFailureAt: 0,
  lastDbStatus: 'unknown',
};

function getCircuitBreakerState() {
  if (circuitBreaker.state === 'open') {
    // Verificar si ya pasó el timeout para pasar a half-open
    if (Date.now() - circuitBreaker.lastFailureAt >= circuitBreaker.resetTimeoutMs) {
      circuitBreaker.state = 'half-open';
    }
  }
  return circuitBreaker.state;
}

function recordSuccess() {
  circuitBreaker.failureCount = 0;
  circuitBreaker.state = 'closed';
  circuitBreaker.lastDbStatus = 'connected';
}

function recordFailure() {
  circuitBreaker.failureCount += 1;
  circuitBreaker.lastFailureAt = Date.now();
  circuitBreaker.lastDbStatus = 'unavailable';

  if (circuitBreaker.failureCount >= circuitBreaker.failureThreshold) {
    circuitBreaker.state = 'open';
  }
}

// ── Referencia al subscriber MQTT (inyectada desde server.js) ───────────────
let mqttSubscriberRef = null;

function setMqttSubscriberRef(subscriberFn) {
  mqttSubscriberRef = subscriberFn;
}

router.get('/', async (req, res) => {
  // ── Database health con circuit breaker ────────────────────────────────
  let dbStatus = circuitBreaker.lastDbStatus;
  const cbState = getCircuitBreakerState();

  if (cbState !== 'open') {
    try {
      await pool.query('SELECT 1');
      recordSuccess();
      dbStatus = 'connected';
    } catch (error) {
      recordFailure();
      dbStatus = 'unavailable';
    }
  }

  // ── MQTT status ────────────────────────────────────────────────────────
  let mqttStatus = 'unconfigured';
  if (mqttSubscriberRef) {
    try {
      mqttStatus = mqttSubscriberRef() ? 'connected' : 'disconnected';
    } catch {
      mqttStatus = 'error';
    }
  }

  // ── Supabase health ────────────────────────────────────────────────────
  const supabaseHealth = await checkSupabaseHealth();

  // ── Resultado global ──────────────────────────────────────────────────
  const isOk = dbStatus === 'connected' || supabaseHealth.status === 'connected';

  res.status(isOk ? 200 : 503).json({
    status: isOk ? 'ok' : 'degraded',
    database: dbStatus,
    mqtt: mqttStatus,
    supabase: supabaseHealth.status,
    circuitBreaker: cbState,
    uptime: Math.floor(process.uptime()),
  });
});

module.exports = router;
module.exports.setMqttSubscriberRef = setMqttSubscriberRef;
