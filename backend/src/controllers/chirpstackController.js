const { adaptChirpstackUplink } = require('../services/chirpstackAdapter');
const { ingestEvent } = require('../services/ingestaService');

// Almacén en memoria del último payload recibido para inspección y depuración
let lastReceivedPayload = {
  receivedAt: null,
  eventType: null,
  query: {},
  headers: {},
  body: null,
  adapterResult: null,
};

async function handleChirpstackUplink(req, res, next) {
  try {
    const queryEvent = (req.query.event || '').toLowerCase();
    const headerEvent = (req.headers['x-chirpstack-event'] || '').toLowerCase();
    const body = req.body || {};

    // Determinar el tipo de evento ChirpStack
    let eventType = queryEvent || headerEvent;
    if (!eventType) {
      if (body.object || body.data || body.fPort !== undefined) {
        eventType = 'up';
      } else if (body.devAddr && !body.data) {
        eventType = 'join';
      } else {
        eventType = 'up';
      }
    }

    const devEui = body.deviceInfo?.devEui || body.devEUI || body.devEui || 'Desconocido';
    const deviceName = body.deviceInfo?.deviceName || body.deviceName || 'Desconocido';

    // 1. Manejo de eventos de activación (Join)
    if (eventType === 'join') {
      console.log(`\x1b[32m[ChirpStack Webhook]\x1b[0m 🚀 Dispositivo UNIDO exitosamente: ${deviceName} (DevEUI: ${devEui})`);
      lastReceivedPayload = {
        receivedAt: new Date().toISOString(),
        eventType: 'join',
        query: req.query,
        headers: {
          'user-agent': req.headers['user-agent'],
          'content-type': req.headers['content-type'],
        },
        body,
        adapterResult: { status: 'joined', deviceName, devEui },
      };

      return res.status(200).json({
        status: 'ok',
        event: 'join',
        message: `Dispositivo ${deviceName} conectado a la red LoRaWAN correctamente.`,
      });
    }

    // 2. Manejo de otros eventos informativos (ack, txack, status, error, etc.)
    if (eventType !== 'up') {
      console.log(`\x1b[36m[ChirpStack Webhook]\x1b[0m Evento '${eventType}' recibido para: ${deviceName} (${devEui})`);
      lastReceivedPayload = {
        receivedAt: new Date().toISOString(),
        eventType,
        query: req.query,
        headers: { 'content-type': req.headers['content-type'] },
        body,
        adapterResult: { status: 'acknowledged', eventType },
      };

      return res.status(200).json({
        status: 'ok',
        event: eventType,
        message: 'Evento recibido y registrado.',
      });
    }

    // 3. Manejo de Telemetría (Uplink: event=up)
    const { normalizedEvent, meta } = adaptChirpstackUplink(body, req.query, req.headers);

    console.log(`\x1b[34m[ChirpStack Uplink]\x1b[0m Recibido paquete de: \x1b[1m${meta.deviceName}\x1b[0m (DevEUI: ${meta.devEui})`);
    console.log(`                    -> Mapeado a Tablero: \x1b[33m${meta.idTablero}\x1b[0m | Tipo: ${normalizedEvent.tipo_evento}`);
    console.log(`                    -> Tensión: ${normalizedEvent.datos.tension_medida_v}V | Corriente: ${normalizedEvent.datos.corriente_medida_ma}mA | RSSI: ${normalizedEvent.datos.rssi_lora}dBm`);

    // Ingestar en la base de datos PostgreSQL mediante el servicio transaccional existente
    const ingestionResult = await ingestEvent(normalizedEvent, {
      source: 'chirpstack_http',
      ip: req.ip,
      devEui: meta.devEui,
      deviceName: meta.deviceName,
    });

    lastReceivedPayload = {
      receivedAt: new Date().toISOString(),
      eventType: 'up',
      query: req.query,
      headers: {
        'user-agent': req.headers['user-agent'],
        'content-type': req.headers['content-type'],
      },
      body,
      adapterResult: {
        normalizedEvent,
        meta,
        ingestionResult,
      },
    };

    if (ingestionResult.duplicate) {
      return res.status(202).json({
        status: 'ok',
        event: 'up',
        ingestionStatus: 'duplicate',
        tablero: meta.idTablero,
        message: 'Uplink duplicado descartado por ventana de deduplicación.',
      });
    }

    return res.status(201).json({
      status: 'ok',
      event: 'up',
      ingestionStatus: 'persisted',
      tablero: meta.idTablero,
      data: ingestionResult,
    });
  } catch (error) {
    console.error('\x1b[31m[ChirpStack Error]\x1b[0m Error procesando webhook de ChirpStack:', error);
    lastReceivedPayload = {
      receivedAt: new Date().toISOString(),
      eventType: 'error',
      error: error.message,
      body: req.body,
    };
    next(error);
  }
}

function getLastUplink(req, res) {
  res.json({
    status: 'ok',
    data: lastReceivedPayload,
  });
}

module.exports = {
  handleChirpstackUplink,
  getLastUplink,
};
