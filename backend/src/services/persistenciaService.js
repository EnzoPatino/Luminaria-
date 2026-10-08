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
    id_tablero: sensor.id_tablero,
    timestamp: event.timestamp || null,
    fecha_hora: event.timestamp || null,
    valor_tension: tension,
    valor_corriente: corriente,
    amperaje: corriente,
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

    if (event.tipo_evento === 'TELEMETRIA_NORMAL') {
      if (Array.isArray(data.focos_restaurados) && data.focos_restaurados.length > 0) {
        await client.query(
          `UPDATE alertas
           SET estado_alerta = 'resuelta',
               estado = 'resuelta',
               fecha_resolucion = now(),
               resuelto_por = NULL
           WHERE id_tablero = $1
             AND (
               tipo_alerta = 'BAJA_TENSION'
               OR (tipo_alerta IN ('FOCO_QUEMADO', 'DESCONEXION_ABRUPTA_FOCO') AND id_foco_afectado = ANY($2::text[]))
             )
             AND estado_alerta = 'activa'`,
          [tablero.id_tablero, data.focos_restaurados.map(String)]
        );
      } else {
        await client.query(
          `UPDATE alertas
           SET estado_alerta = 'resuelta',
               estado = 'resuelta',
               fecha_resolucion = now(),
               resuelto_por = NULL
           WHERE id_tablero = $1
             AND tipo_alerta IN ('BAJA_TENSION', 'FOCO_QUEMADO', 'DESCONEXION_ABRUPTA_FOCO')
             AND estado_alerta = 'activa'`,
          [tablero.id_tablero]
        );
      }
    }

    let alerta = null;
    if (event.tipo_evento !== 'TELEMETRIA_NORMAL') {
      const idFoco = data.id_foco != null ? String(data.id_foco) : null;
      const activas = await client.query(
        `SELECT *
         FROM alertas
         WHERE id_tablero = $1
           AND tipo_alerta = $2
           AND id_foco_afectado IS NOT DISTINCT FROM $3
           AND estado_alerta = 'activa'
         ORDER BY id_alerta ASC
         FOR UPDATE`,
        [tablero.id_tablero, event.tipo_evento, idFoco]
      );

      if (activas.rowCount > 0) {
        // Una condición persistente conserva una sola alerta activa aunque
        // lleguen muchos ticks o ya hubiera duplicados activos anteriores.
        alerta = activas.rows[0];
        const duplicadas = activas.rows.slice(1).map((item) => item.id_alerta);
        if (duplicadas.length > 0) {
          await client.query(
            `UPDATE alertas
             SET estado_alerta = 'resuelta',
                 estado = 'resuelta',
                 fecha_resolucion = now(),
                 resuelto_por = NULL
             WHERE id_alerta = ANY($1::bigint[])`,
            [duplicadas]
          );
        }
      } else {
        alerta = await alertasModel.create(client, {
          id_tablero: tablero.id_tablero,
          id_lectura: lectura ? lectura.id_lectura : null,
          tipo_alerta: event.tipo_evento,
          id_foco_afectado: idFoco,
          ubicacion: event.ubicacion ? String(event.ubicacion) : tablero.ubicacion,
          fecha_hora_generada: event.timestamp || null,
          prioridad: event.severidad,
          es_persistente: isPersistentSeverity(event.severidad),
          datos_json: data,
        });
      }
    }

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
