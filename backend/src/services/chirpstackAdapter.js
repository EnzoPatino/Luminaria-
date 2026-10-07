/**
 * Adaptador de ChirpStack para el Backend de Luminaria.
 * Transforma los webhooks HTTP de ChirpStack (v3/v4) en eventos normalizados
 * compatibles con el sistema de ingesta y PostgreSQL de Luminaria.
 */

function parseCustomDeviceMap() {
  if (!process.env.CHIRPSTACK_DEVICE_MAP) return {};
  try {
    return JSON.parse(process.env.CHIRPSTACK_DEVICE_MAP);
  } catch (err) {
    console.warn('[ChirpStack Adapter] Advertencia: CHIRPSTACK_DEVICE_MAP no es un JSON válido:', err.message);
    return {};
  }
}

// Mapeo por defecto conocido para los nodos del proyecto (ej: Arduino EPET 14)
const DEFAULT_DEVICE_MAP = {
  '24e124746e392242': 'TABLERO_01',
  'arduinorfm95_v2': 'TABLERO_01',
  'arduinorfm95_v.2': 'TABLERO_01',
};

/**
 * Resuelve el identificador de tablero (id_tablero) a partir de los metadatos del dispositivo LoRaWAN.
 */
function resolveTableroId(deviceInfo = {}, devEuiRaw = '') {
  const customMap = parseCustomDeviceMap();
  const devEui = String(deviceInfo.devEui || deviceInfo.devEUI || devEuiRaw || '').trim().toLowerCase();
  const deviceName = String(deviceInfo.deviceName || '').trim();
  const deviceNameLower = deviceName.toLowerCase();

  // 1. Verificar mapa personalizado de entorno
  if (devEui && customMap[devEui]) return customMap[devEui];
  if (deviceName && customMap[deviceName]) return customMap[deviceName];
  if (deviceNameLower && customMap[deviceNameLower]) return customMap[deviceNameLower];

  // 2. Verificar mapa por defecto
  if (devEui && DEFAULT_DEVICE_MAP[devEui]) return DEFAULT_DEVICE_MAP[devEui];
  if (deviceNameLower && DEFAULT_DEVICE_MAP[deviceNameLower]) return DEFAULT_DEVICE_MAP[deviceNameLower];

  // 3. Si el nombre del dispositivo ya sigue el formato TABLERO_XX o TAB-XX
  if (/^TAB(LERO)?[_\s-]?\d+$/i.test(deviceName)) {
    const match = deviceName.match(/\d+/);
    if (match) {
      const num = match[0].padStart(2, '0');
      return `TABLERO_${num}`;
    }
  }

  // 4. Fallback seguro: usar el nombre del dispositivo o devEui saneado
  if (deviceName) {
    return deviceName.replace(/[^a-zA-Z0-9_-]/g, '_').toUpperCase();
  }

  if (devEui) {
    return `TAB_${devEui.slice(-6).toUpperCase()}`;
  }

  return 'TABLERO_01';
}

/**
 * Extrae y acota métricas de radio (RSSI y SNR).
 * Soporta tanto ChirpStack v4 (rxInfo[]) como ChirpStack v3 (propiedades en la raíz del payload).
 */
function extractRadioMetrics(rxInfo, body = {}) {
  let rawRssi = null;
  let rawSnr = null;

  // 1. Intentar desde el array rxInfo (gateways)
  if (Array.isArray(rxInfo) && rxInfo.length > 0) {
    let bestRx = rxInfo[0];
    for (let i = 1; i < rxInfo.length; i++) {
      const current = rxInfo[i];
      if (current && typeof current.rssi === 'number') {
        if (!bestRx || typeof bestRx.rssi !== 'number' || current.rssi > bestRx.rssi) {
          bestRx = current;
        }
      }
    }
    if (bestRx && typeof bestRx.rssi === 'number') {
      rawRssi = Math.round(bestRx.rssi);
      rawSnr = typeof bestRx.snr === 'number'
        ? bestRx.snr
        : typeof bestRx.loRaSNR === 'number'
          ? bestRx.loRaSNR
          : null;
    }
  }

  // 2. Fallback a campos en la raíz (típico en ChirpStack v3: payload.rssi, payload.loRaSNR)
  if (rawRssi === null && typeof body.rssi === 'number') {
    rawRssi = Math.round(body.rssi);
  }
  if (rawSnr === null) {
    if (typeof body.loRaSNR === 'number') rawSnr = body.loRaSNR;
    else if (typeof body.snr === 'number') rawSnr = body.snr;
  }

  // Asegurar que el RSSI esté dentro de los límites válidos del schema (-150 a 20 dBm)
  const rssi = rawRssi !== null ? Math.max(-150, Math.min(20, rawRssi)) : null;
  const snr = rawSnr !== null ? Number(rawSnr.toFixed(1)) : null;

  return { rssi, snr };
}

/**
 * Decodifica el payload si viene crudo en Base64 (data).
 * Soporta payloads binarios de 2 bytes (Arduino EPET 14: ADC uint16 Big-Endian).
 */
function decodeBase64Payload(base64Data) {
  if (!base64Data || typeof base64Data !== 'string') return null;

  try {
    const buf = Buffer.from(base64Data, 'base64');
    if (buf.length === 0) return null;

    // Caso A: Trama binaria de 2 bytes (Arduino UNO + Shield Dragino RFM95 EPET N° 14)
    // Representa lectura analógica de 10 bits (0-1023) en formato Big-Endian
    if (buf.length === 2) {
      const adc = buf.readUInt16BE(0);
      const volt = Math.round((adc * 5.0 / 1023.0) * 1000) / 1000;
      return {
        potenciometro: adc,
        voltaje: volt,
        adc,
        rawHex: buf.toString('hex'),
      };
    }

    // Intentar interpretar como string UTF-8
    const text = buf.toString('utf8').trim();

    // Caso B: JSON en texto plano (ej: {"v": 220, "i": 450})
    if (text.startsWith('{') && text.endsWith('}')) {
      try {
        return JSON.parse(text);
      } catch (_) {}
    }

    // Caso C: CSV en texto plano (ej: "220,450" o "220.5,450,L1")
    if (/^[\d.,\s;L]+$/.test(text) && (text.includes(',') || text.includes(';'))) {
      const parts = text.split(/[,;]/).map(p => p.trim());
      const v = parseFloat(parts[0]);
      const i = parseFloat(parts[1]);
      if (!isNaN(v)) {
        return {
          tension: v,
          corriente: !isNaN(i) ? i : undefined,
          fase: parts[2] || undefined,
        };
      }
    }

    // Caso D: Bytes binarios estructurados de 4 bytes (ej: 2 bytes voltaje, 2 bytes corriente)
    if (buf.length >= 4) {
      const be1 = buf.readUInt16BE(0);
      const be2 = buf.readUInt16BE(2);
      const le1 = buf.readUInt16LE(0);
      const le2 = buf.readUInt16LE(2);

      let tension = null;
      let corriente = null;

      if (be1 >= 1000 && be1 <= 3000) {
        tension = be1 / 10;
        corriente = be2;
      } else if (le1 >= 1000 && le1 <= 3000) {
        tension = le1 / 10;
        corriente = le2;
      } else if (be1 >= 100 && be1 <= 300) {
        tension = be1;
        corriente = be2;
      } else if (le1 >= 100 && le1 <= 300) {
        tension = le1;
        corriente = le2;
      }

      if (tension !== null) {
        return { tension, corriente, rawHex: buf.toString('hex') };
      }
    }

    return { rawHex: buf.toString('hex') };
  } catch (err) {
    console.warn('[ChirpStack Adapter] No se pudo decodificar payload Base64:', err.message);
    return null;
  }
}

/**
 * Normaliza las mediciones extraídas a valores numéricos consistentes.
 * Maneja los tres escenarios de ChirpStack v3 (object, objectJSON como objeto, objectJSON como string JSON)
 * y escala adecuadamente el potenciómetro a la tensión de prueba de red (0-250V).
 */
function extractMeasurements(body) {
  let objectData = {};

  // Escenario 1: Objeto directo bajo 'object' (ChirpStack v4 o v3 configurado)
  if (body.object && typeof body.object === 'object') {
    objectData = { ...body.object };
  }

  // Escenario 2 & 3: Objeto o string JSON bajo 'objectJSON' (ChirpStack v3 por defecto)
  if (body.objectJSON) {
    if (typeof body.objectJSON === 'object') {
      objectData = { ...objectData, ...body.objectJSON };
    } else if (typeof body.objectJSON === 'string') {
      try {
        const parsed = JSON.parse(body.objectJSON);
        if (parsed && typeof parsed === 'object') {
          objectData = { ...objectData, ...parsed };
        }
      } catch (err) {
        console.warn('[ChirpStack Adapter] Advertencia al parsear body.objectJSON:', err.message);
      }
    }
  }

  // Decodificación binaria o textual de data Base64
  const decodedData = decodeBase64Payload(body.data) || {};

  // Unir fuentes, priorizando lo decodificado por el códec de ChirpStack sobre el Base64 crudo
  const merged = { ...decodedData, ...objectData };

  // Extracción de lectura de tensión directa o potenciometro
  const rawTension = merged.tension_medida_v
    ?? merged.tension
    ?? merged.voltaje
    ?? merged.voltage
    ?? merged.volts
    ?? merged.v;

  const rawPotenciometro = merged.potenciometro ?? merged.adc ?? merged.adc_val;

  let tension;
  const scalePot = process.env.CHIRPSTACK_SCALE_POTENTIOMETER !== 'false';
  const potMaxV = parseFloat(process.env.CHIRPSTACK_POTENTIOMETER_MAX_V || '250.0');

  if (rawTension !== undefined && typeof rawTension === 'number' && !isNaN(rawTension)) {
    // Si viene tensión en rango de Arduino (0-5V) y la escala de simulación está activa:
    // Se escala 0-5V -> 0-250V para que al girar el potenciómetro se puedan simular
    // estados normales (~220V) y disparar BAJA_TENSION (< 190V) tal como fue diseñado en el laboratorio.
    if (scalePot && rawTension <= 5.0) {
      tension = Number(((rawTension / 5.0) * potMaxV).toFixed(2));
    } else {
      tension = Number(rawTension.toFixed(2));
    }
  } else if (rawPotenciometro !== undefined && typeof rawPotenciometro === 'number' && !isNaN(rawPotenciometro)) {
    if (scalePot) {
      tension = Number(((rawPotenciometro / 1023.0) * potMaxV).toFixed(2));
    } else {
      tension = Number(((rawPotenciometro * 5.0) / 1023.0).toFixed(2));
    }
  } else {
    // Valor nominal seguro si no se recibió dato de tensión
    tension = 220.0;
  }

  // Extracción de corriente
  let corriente = merged.corriente_medida_ma
    ?? merged.corriente_actual_ma
    ?? merged.corriente
    ?? merged.current
    ?? merged.amperaje
    ?? merged.i
    ?? merged.ma;

  // Si la corriente viene en Amperes decimales (ej: 0.45A), convertir a mA
  if (typeof corriente === 'number' && corriente > 0 && corriente < 20) {
    corriente = Math.round(corriente * 1000);
  }

  // Extracción de fase
  let fase = String(merged.fase || 'L1').trim().toUpperCase();
  if (!['L1', 'L2', 'L3'].includes(fase)) {
    fase = 'L1';
  }

  return {
    tension: typeof tension === 'number' && !isNaN(tension) ? tension : 220.0,
    corriente: typeof corriente === 'number' && !isNaN(corriente) ? Number(corriente.toFixed(2)) : 450.0,
    fase,
    focoAfectado: merged.id_foco || merged.foco || null,
    estadoCircuito: merged.estado_circuito || 'ACTIVO',
    rawObject: merged,
    rawPotenciometro,
    sensorVoltaje: merged.voltaje,
  };
}

/**
 * Transforma un cuerpo de uplink de ChirpStack en un evento válido para ingestEvent().
 */
function adaptChirpstackUplink(body, query = {}, headers = {}) {
  const deviceInfo = body.deviceInfo || {};
  const devEui = deviceInfo.devEui || deviceInfo.devEUI || body.devEUI || body.devEui || '';
  const deviceName = deviceInfo.deviceName || body.deviceName || 'ArduinoRFM95_v2';
  const appName = deviceInfo.applicationName || body.applicationName || '';
  const idTablero = resolveTableroId(deviceInfo, devEui);

  const { rssi, snr } = extractRadioMetrics(body.rxInfo, body);
  const {
    tension,
    corriente,
    fase,
    focoAfectado,
    rawObject,
    rawPotenciometro,
    sensorVoltaje,
  } = extractMeasurements(body);

  // Timestamp ISO
  let timestamp = body.time || body.publishedAt;
  if (!timestamp || isNaN(Date.parse(timestamp))) {
    timestamp = new Date().toISOString();
  } else {
    timestamp = new Date(timestamp).toISOString();
  }

  // Clasificación de anomalías eléctricas
  let tipoEvento = 'TELEMETRIA_NORMAL';
  let severidad = 'INFO';
  let datos = {};

  if (tension < 190.0) {
    tipoEvento = 'BAJA_TENSION';
    severidad = 'CRITICA';
    datos = {
      tension_medida_v: tension,
      tension_nominal_v: 220.0,
      umbral_minimo_v: 190.0,
      fase,
      corriente_medida_ma: corriente,
      corriente_actual_ma: corriente,
      rssi_lora: rssi !== null ? rssi : -90,
      estado_conexion: 'ONLINE',
    };
  } else if (focoAfectado && corriente < 50) {
    tipoEvento = 'DESCONEXION_ABRUPTA_FOCO';
    severidad = 'CRITICA';
    datos = {
      id_foco: String(focoAfectado),
      corriente_previa_ma: 450.0,
      corriente_actual_ma: corriente,
      tiempo_caida_ms: 120,
      estado_circuito: 'ACTIVO',
      tension_medida_v: tension,
      tension_nominal_v: 220.0,
      fase,
      rssi_lora: rssi !== null ? rssi : -90,
      estado_conexion: 'ONLINE',
    };
  } else {
    // Caso normal
    datos = {
      tension_medida_v: tension,
      tension_nominal_v: 220.0,
      fase,
      corriente_medida_ma: corriente,
      corriente_actual_ma: corriente,
      rssi_lora: rssi !== null ? rssi : -90,
      estado_conexion: 'ONLINE',
    };
  }

  const normalizedEvent = {
    tipo_evento: tipoEvento,
    id_tablero: idTablero,
    timestamp,
    severidad,
    ubicacion: appName ? `Aplicación: ${appName}` : 'Neuquén Capital',
    datos,
  };

  return {
    normalizedEvent,
    meta: {
      devEui,
      deviceName,
      idTablero,
      fPort: body.fPort,
      fCnt: body.fCnt,
      rssi,
      snr,
      rawMeasurements: rawObject,
      rawPotenciometro,
      sensorVoltaje,
      calculatedTension: tension,
    },
  };
}

module.exports = {
  adaptChirpstackUplink,
  resolveTableroId,
  decodeBase64Payload,
  extractRadioMetrics,
};
