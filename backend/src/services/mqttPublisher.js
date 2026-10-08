const config = require('../config');
const { MqttTcpClient } = require('./mqttTcpClient');

let publisherClient = null;

function getMqttPublisher() {
  if (publisherClient) return publisherClient;

  publisherClient = new MqttTcpClient({
    host: config.mqtt.host,
    port: config.mqtt.port,
    clientId: `luminaria_api_pub_${process.pid}_${Math.random().toString(16).substring(2, 6)}`,
    username: config.mqtt.username || '',
    password: config.mqtt.password || '',
    topics: [], // Publisher puro: no requiere suscribirse a topics
    keepAliveSeconds: 60,
    reconnectMs: 5000,
    useTls: config.mqtt.useTls,
  });

  publisherClient.on('connect', () => {
    console.log(`[MQTT Publisher] Conectado a Mosquitto en ${config.mqtt.host}:${config.mqtt.port}.`);
  });

  publisherClient.on('error', (err) => {
    // Registro preventivo no bloqueante para no interrumpir la ingesta HTTP si Mosquitto reinicia
    console.warn(`[MQTT Publisher] Aviso de conexión a broker: ${err.message}`);
  });

  publisherClient.start();
  return publisherClient;
}

function broadcastEvent(event) {
  if (!event || !event.id_tablero) return false;

  try {
    const publisher = getMqttPublisher();
    if (!publisher || !publisher.connected) return false;

    const payload = JSON.stringify(event);
    const topicTablero = `neuquen/iluminacion/${event.id_tablero}`;

    publisher.publish(topicTablero, payload, 0);
    publisher.publish('api/evento', payload, 0);
    return true;
  } catch (err) {
    console.warn('[MQTT Publisher] Error transmitiendo evento a Mosquitto:', err.message);
    return false;
  }
}

module.exports = {
  getMqttPublisher,
  broadcastEvent,
};
