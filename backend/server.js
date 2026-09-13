require("dotenv").config();

const app = require("./src/app");
const config = require("./src/config");
const {
  startMaintenanceScheduler,
  stopMaintenanceScheduler,
} = require("./src/services/mantenimientoScheduler");
const { closePool } = require("./src/config/database");
const { createMqttSubscriber } = require("./src/workers/mqttSubscriber");

const PORT = config.port || 3000;
const mqttSubscriber = createMqttSubscriber();
let shuttingDown = false;

const server = app.listen(PORT, () => {
  console.log(` Server running in ${config.env} mode on port ${PORT}`);
  console.log(`Health check available at http://localhost:${PORT}/api/health`);
  console.log(
    `Event ingestion available at http://localhost:${PORT}/api/eventos`,
  );

  // Seccion: procesos autonomos que deben correr aunque no haya navegador abierto.
  startMaintenanceScheduler();
  mqttSubscriber.start();
});

function closeHttpServer() {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) return reject(error);
      return resolve();
    });
  });
}

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`\n${signal} recibido. Cerrando servidor HTTP...`);

  const forceExitTimer = setTimeout(() => process.exit(1), 10000);
  forceExitTimer.unref();

  try {
    stopMaintenanceScheduler();
    await mqttSubscriber.stop();
    await closeHttpServer();
    await closePool();
    console.log("Servidor cerrado correctamente.");
    clearTimeout(forceExitTimer);
    process.exit(0);
  } catch (error) {
    console.error("Error durante shutdown.", error);
    process.exit(1);
  }
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION!  Shutting down...");
  console.error(err);
  shutdown("uncaughtException");
});

process.on("unhandledRejection", (err) => {
  console.error("UNHANDLED REJECTION!  Shutting down...");
  console.error(err);
  shutdown("unhandledRejection");
});
