const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const routes = require('./routes');
const logger = require('./services/logger');
const { correlationMiddleware } = require('./middlewares/correlationMiddleware');

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', config.trustProxy);

// ─────────────────────────────────────────────────────────────────────────────
// SEC-01 / BB-09: Headers de seguridad HTTP obligatorios.
// Estos headers protegen contra ataques comunes (XSS, clickjacking, MIME
// sniffing, downgrade HTTPS) sin romper funcionalidad.
// ─────────────────────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '0');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  // HSTS: solo en producción para no bloquear desarrollo local
  if (config.env === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' wss: https:; font-src 'self'"
    );
  }

  next();
});

// BE-09: Middleware de correlación (genera un ID único por request)
app.use(correlationMiddleware);

// BE-09: Request logger estructurado con correlation_id
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`, {
      correlation_id: req.correlationId,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      duration_ms: duration,
      ip: req.ip,
    });
  });
  next();
});

// BB-06: CORS restringido con lista blanca configurable
const defaultOrigins = ['http://localhost:3000', 'http://localhost:5500', 'http://127.0.0.1:5500'];
const configuredOrigins = config.corsOrigin
  ? config.corsOrigin.split(',').map(o => o.trim()).filter(Boolean)
  : [];
const allowedOrigins = [...new Set([...defaultOrigins, ...configuredOrigins])];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS policy: El origen '${origin}' no está autorizado.`));
  },
  credentials: true,
}));

// BB-07: Rate Limiting por IP en endpoints de API
const apiLimiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      status: 'error',
      statusCode: 429,
      message: 'Demasiadas solicitudes desde esta IP, por favor intente más tarde.',
    });
  },
});

app.use('/api', apiLimiter);

// Límite de payload de 1MB
app.use(express.json({ limit: '1mb' }));

app.get('/', (req, res) => {
  res.json({
    name: 'luminaria-backend',
    status: 'ok',
  });
});

app.use('/api', routes);

// BB-02: Middleware 404 para rutas inexistentes en formato JSON
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    statusCode: 404,
    message: `Ruta no encontrada: ${req.method} ${req.originalUrl}`,
  });
});

// BB-08: Manejador centralizado de errores
app.use((err, req, res, next) => {
  const statusCode = err.status || err.statusCode || (err.message && err.message.includes('CORS') ? 403 : 500);

  logger.error('Error en API', {
    correlation_id: req.correlationId,
    status: statusCode,
    code: err.code,
    message: err.message,
    stack: config.env === 'development' ? err.stack : undefined,
  });

  res.status(statusCode).json({
    status: 'error',
    statusCode,
    ...(err.code && { code: err.code }),
    message: err.message || 'Error interno del servidor.',
    ...(err.details && { details: err.details }),
    ...(config.env === 'development' && { stack: err.stack }),
  });
});

module.exports = app;
