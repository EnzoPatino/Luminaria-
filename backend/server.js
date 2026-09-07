require('dotenv').config();

const app = require('./src/app');
const config = require('./src/config');
const { startMaintenanceScheduler, stopMaintenanceScheduler } = require('./src/services/mantenimientoScheduler');

const PORT = config.port || 3000;

const server = app.listen(PORT, () => {
  console.log(`🚀 Server running in ${config.env} mode on port ${PORT}`);
  console.log(`Health check available at http://localhost:${PORT}/api/health`);
  console.log(`Event ingestion available at http://localhost:${PORT}/api/eventos`);
  startMaintenanceScheduler();
});

function shutdown(signal) {
  console.log(`\n${signal} recibido. Cerrando servidor HTTP...`);
  stopMaintenanceScheduler();
  server.close(() => {
    console.log('Servidor cerrado correctamente.');
    process.exit(0);
  });

  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  console.error(err);
  shutdown('uncaughtException');
});

process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION! 💥 Shutting down...');
  console.error(err);
  shutdown('unhandledRejection');
});
