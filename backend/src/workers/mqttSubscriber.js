require('dotenv').config();

const config = require('../config');
const { closePool } = require('../config/database');
const { ingestEvent } = require('../services/ingestaService');
const { MqttTcpClient } = require('../services/mqttTcpClient');

function createMqttSubscriber(overrides = {}) {
  const mqttConfig = {
    ...config.mqtt,
    ...overrides,
  };

  let client = null;
  let queue = Promise.resolve();

  async function processMessage(topic, payload, packetInfo) {
    let parsed;

    try {
      parsed = JSON.parse(payload.toString('utf8'));
    } catch (error) {
      console.error('[MQTT] Payload descartado: JSON invalido.', {
        topic,
        error: error.message,
      });
      return;
    }

    try {
      // Seccion: ingesta transaccional reutilizada por MQTT y HTTP.
      const result = await ingestEvent(parsed, {
        source: 'mqtt',
        topic,
        qos: packetInfo.qos,
      });

      if (result.duplicate) {
        console.warn('[MQTT] Evento duplicado descartado por ventana de deduplicacion.', {
          topic,
          id_tablero: result.event.id_tablero,
          tipo_evento: result.event.tipo_evento,
        });
        return;
      }

      console.log('[MQTT] Evento persistido en PostgreSQL.', {
        topic,
        id_tablero: result.event.id_tablero,
        tipo_evento: result.event.tipo_evento,
      });
    } catch (error) {
      console.error('[MQTT] Error procesando evento.', {
        topic,
        code: error.code,
        message: error.message,
        details: error.details,
      });
    }
  }

  function enqueueMessage(topic, payload, packetInfo) {
    queue = queue
      .then(() => processMessage(topic, payload, packetInfo))
      .catch((error) => {
        console.error('[MQTT] Error inesperado en cola de ingesta.', error);
      });
  }

  function start() {
    if (!mqttConfig.enabled) {
      console.log('[MQTT] Subscriber deshabilitado por configuracion.');
      return null;
    }

    if (client) return client;

    client = new MqttTcpClient(mqttConfig);

    // Seccion: observabilidad minima para diagnosticar broker, auth y reconexiones.
    client.on('connect', () => {
      console.log(`[MQTT] Conectado a ${mqttConfig.host}:${mqttConfig.port}.`);
    });
    client.on('subscribe', ({ topic, qos }) => {
      console.log(`[MQTT] Suscripto a ${topic} con QoS ${qos}.`);
    });
    client.on('reconnect', () => {
      console.warn(`[MQTT] Reintentando conexion en ${mqttConfig.host}:${mqttConfig.port}.`);
    });
    client.on('error', (error) => {
      console.error('[MQTT] Error de conexion.', error.message);
    });
    client.on('message', enqueueMessage);

    client.start();
    return client;
  }

  async function stop() {
    if (client) {
      client.stop();
      client = null;
    }

    await queue;
  }

  return {
    start,
    stop,
    isRunning: () => Boolean(client && client.connected),
  };
}

async function runStandalone() {
  const subscriber = createMqttSubscriber({ enabled: true });
  subscriber.start();

  async function shutdown(signal) {
    console.log(`\n${signal} recibido. Cerrando worker MQTT...`);
    await subscriber.stop();
    await closePool();
    process.exit(0);
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

if (require.main === module) {
  runStandalone().catch((error) => {
    console.error('[MQTT] Worker finalizado por error fatal.', error);
    process.exit(1);
  });
}

module.exports = { createMqttSubscriber };
