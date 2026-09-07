const { withTransaction } = require('../config/database');
const tablerosModel = require('../models/tablerosModel');
const sensoresModel = require('../models/sensoresModel');
const lecturasModel = require('../models/lecturasModel');
const alertasModel = require('../models/alertasModel');

const VALID_SEVERITIES = new Set(['CRITICA', 'ADVERTENCIA', 'INFO']);

function isPersistentSeverity(severidad) {
  return severidad === 'CRITICA';
}

function toNullableNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function buildReading(event, sensor) {
  const data = event.datos && typeof event.datos === 'object' ? event.datos : {};
  const tension = toNullableNumber(data.tension_medida_v);
  const corriente = toNullableNumber(
    data.corriente_actual_ma ?? data.corriente_medida_ma
  );
  const fase = data.fase ? String(data.fase) : null;
  const rssi = toNullableNumber(data.rssi_lora);
  const estadoConexion = data.estado_conexion
    ? String(data.estado_conexion)
    : null;

  const hasTelemetry = tension !== null || corriente !== null || fase !== null || rssi !== null || estadoConexion !== null;

  if (!hasTelemetry) return null;

  return {
    id_sensor: sensor.id_sensor,
    timestamp: event.timestamp || null,
    valor_tension: tension,
    valor_corriente: corriente,
    fase,
    rssi_lora: rssi,
    estado_conexion: estadoConexion,
  };
}

function validateEvent(event) {
  if (!event || typeof event !== 'object') {
    throw new TypeError('El evento debe ser un objeto JSON.');
  }

  if (!event.tipo_evento || typeof event.tipo_evento !== 'string') {
    throw new TypeError('Falta tipo_evento.');
  }

  if (!event.id_tablero || typeof event.id_tablero !== 'string') {
    throw new TypeError('Falta id_tablero.');
  }

  if (!event.severidad || !VALID_SEVERITIES.has(event.severidad)) {
    throw new TypeError('severidad debe ser CRITICA, ADVERTENCIA o INFO.');
  }
}

async function persistEvent(event) {
  validateEvent(event);

  return withTransaction(async (client) => {
    const tablero = await tablerosModel.upsertFromEvent(client, event);
    const sensor = await sensoresModel.getOrCreateSensorForTablero(client, tablero.id_tablero);

    const readingData = buildReading(event, sensor);
    const lectura = readingData
      ? await lecturasModel.create(client, readingData)
      : null;

    const data = event.datos && typeof event.datos === 'object' ? event.datos : {};

    const alerta = await alertasModel.create(client, {
      id_tablero: tablero.id_tablero,
      id_lectura: lectura ? lectura.id_lectura : null,
      tipo_alerta: event.tipo_evento,
      id_foco_afectado: data.id_foco != null ? String(data.id_foco) : null,
      ubicacion: event.ubicacion ? String(event.ubicacion) : tablero.ubicacion,
      fecha_hora_generada: event.timestamp || null,
      prioridad: event.severidad,
      es_persistente: isPersistentSeverity(event.severidad),
      datos_json: data,
    });

    const tableroActualizado = await tablerosModel.updateDerivedState(client, tablero.id_tablero);

    return {
      tablero: tableroActualizado,
      sensor,
      lectura,
      alerta,
    };
  });
}

module.exports = { persistEvent, isPersistentSeverity };
