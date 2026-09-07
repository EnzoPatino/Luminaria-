const port = Number(process.env.PORT || 3000);
const rateLimitWindowMs = Number(process.env.RATE_LIMIT_WINDOW_MS || 60000);
const rateLimitMax = Number(process.env.RATE_LIMIT_MAX || 100);

module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: Number.isFinite(port) && port > 0 ? port : 3000,
  corsOrigin: process.env.CORS_ORIGIN || '',
  rateLimitWindowMs: Number.isFinite(rateLimitWindowMs) && rateLimitWindowMs > 0 ? rateLimitWindowMs : 60000,
  rateLimitMax: Number.isFinite(rateLimitMax) && rateLimitMax > 0 ? rateLimitMax : 100,
};
