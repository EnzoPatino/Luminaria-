function toPositiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function toBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return ['true', '1', 'yes', 'on'].includes(String(value).toLowerCase());
}

function toList(value, fallback) {
  if (!value) return fallback;
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

const port = toPositiveNumber(process.env.PORT, 3000);
const rateLimitWindowMs = toPositiveNumber(process.env.RATE_LIMIT_WINDOW_MS, 60000);
const rateLimitMax = toPositiveNumber(process.env.RATE_LIMIT_MAX, 100);
const mqttPort = toPositiveNumber(process.env.MQTT_PORT, 1883);
const mqttQos = Number(process.env.MQTT_QOS || 0);

module.exports = {
  env: process.env.NODE_ENV || 'development',
  port,
  corsOrigin: process.env.CORS_ORIGIN || '',
  trustProxy: process.env.TRUST_PROXY || 'loopback',
  rateLimitWindowMs,
  rateLimitMax,

  // Seccion: limites de integridad para la ingesta previa a PostgreSQL.
  ingestion: {
    deduplicationWindowMs: toPositiveNumber(process.env.INGESTION_DEDUP_WINDOW_MS, 5000),
    rateLimitWindowMs: toPositiveNumber(process.env.INGESTION_RATE_LIMIT_WINDOW_MS, 60000),
    rateLimitMaxPerTablero: toPositiveNumber(process.env.INGESTION_RATE_LIMIT_MAX_PER_TABLERO, 120),
  },

  // Seccion: conexion MQTT TCP para recibir eventos aunque la web este cerrada.
  mqtt: {
    enabled: !['false', '0', 'no', 'off'].includes(String(process.env.MQTT_SUBSCRIBER_ENABLED || 'true').toLowerCase()),
    host: process.env.MQTT_HOST || 'localhost',
    port: mqttPort,
    clientId: process.env.MQTT_CLIENT_ID || `luminaria-backend-${process.pid}`,
    username: process.env.MQTT_USERNAME || '',
    password: process.env.MQTT_PASSWORD || '',
    topics: toList(process.env.MQTT_TOPICS, ['neuquen/iluminacion/#']),
    qos: [0, 1].includes(mqttQos) ? mqttQos : 0,
    keepAliveSeconds: toPositiveNumber(process.env.MQTT_KEEPALIVE_SECONDS, 60),
    reconnectMs: toPositiveNumber(process.env.MQTT_RECONNECT_MS, 5000),
    connectTimeoutMs: toPositiveNumber(process.env.MQTT_CONNECT_TIMEOUT_MS, 10000),
    useTls: toBoolean(process.env.MQTT_USE_TLS, false),
  },

  // Seccion: configuracion Supabase
  supabase: {
    url: process.env.SUPABASE_URL || '',
    publishableKey: process.env.SUPABASE_PUBLISHABLE_KEY || '',
    secretKey: process.env.SUPABASE_SECRET_KEY || '',
    jwksUrl: process.env.SUPABASE_JWKS_URL || '',
  },
};
