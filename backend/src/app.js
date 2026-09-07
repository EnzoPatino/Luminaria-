const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const routes = require('./routes');
const { closePool } = require('./config/database');

const app = express();

app.disable('x-powered-by');

// BB-04: Request logger inline para trazabilidad de peticiones
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`);
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
  console.error('[API Error]', err);
  res.status(statusCode).json({
    status: 'error',
    statusCode,
    message: err.message || 'Error interno del servidor.',
    ...(config.env === 'development' && { stack: err.stack }),
  });
});

process.once('SIGINT', async () => {
  await closePool();
});

process.once('SIGTERM', async () => {
  await closePool();
});

module.exports = app;

