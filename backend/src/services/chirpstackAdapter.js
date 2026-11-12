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
const MIN_ACCEPTABLE_CURRENT_MA = 1000;
const MAX_ACCEPTABLE_CURRENT_MA = 2500;

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function getUplinkTimestamp(value) {
  const body = isPlainObject(value?.payload) ? value.payload : value;
  const timestamp = body?.time || body?.publishedAt;
  const parsed = Date.parse(timestamp);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Normaliza la envoltura que usan algunas integraciones de ChirpStack.
 *
 * Además del webhook habitual, acepta registros como
 * `{ type: 'up', payload: { ... } }` y colecciones de esos registros. Cuando
 * llega un lote se usa el uplink con fecha más reciente para no sobrescribir el
 * estado del tablero con una lectura histórica.
 */
function unwrapChirpstackUplink(input) {
  let envelope = input;

  if (Array.isArray(input)) {
    const records = input.filter(isPlainObject);
    if (records.length === 0) return { body: {}, eventType: '' };

    envelope = records.reduce((latest, current) => {
      const latestTimestamp = getUplinkTimestamp(latest);
      const currentTimestamp = getUplinkTimestamp(current);

      if (currentTimestamp !== null && (latestTimestamp === null || currentTimestamp > latestTimestamp)) {
        return current;
      }
      return latest;
    }, records[0]);
  }

  if (!isPlainObject(envelope)) return { body: {}, eventType: '' };

  const eventType = String(envelope.event || envelope.type || '').toLowerCase();
  const body = isPlainObject(envelope.payload) ? envelope.payload : envelope;
  return { body, eventType };
}

function normalizeDevEui(value) {
  const original = String(value || '').trim();
  const raw = original.toLowerCase();
  if (/^[0-9a-f]{16}$/.test(raw)) return raw;

  if (/^[a-z0-9+/]+={0,2}$/i.test(original)) {
    const decoded = Buffer.from(original, 'base64');
    if (decoded.length === 8) return decoded.toString('hex');
  }

  return raw;
}

/**
 * Resuelve el identificador de tablero (id_tablero) a partir de los metadatos del dispositivo LoRaWAN.
 */
function resolveTableroId(deviceInfo = {}, devEuiRaw = '') {
  const customMap = parseCustomDeviceMap();
  const devEui = normalizeDevEui(deviceInfo.devEui || deviceInfo.devEUI || devEuiRaw || '');
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
 * Soporta payloads binarios de 2 bytes (corriente uint16 Big-Endian en mA).
 */
function decodeBase64Payload(base64Data) {
  if (!base64Data || typeof base64Data !== 'string') return null;

  try {
    const buf = Buffer.from(base64Data, 'base64');
    if (buf.length === 0) return null;

    // El módulo EPET transmite corriente en mA como uint16 Big-Endian.
    if (buf.length === 2) {
      return {
        corriente_medida_ma: buf.readUInt16BE(0),
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
 * y normaliza la corriente a miliamperios.
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
  const rawTension = objectData.tension_medida_v
    ?? objectData.tension
    ?? objectData.voltage
    ?? objectData.volts
    ?? decodedData.tension_medida_v
    ?? decodedData.tension
    ?? decodedData.voltage
    ?? decodedData.volts;

  const rawPotenciometro = objectData.potenciometro
    ?? objectData.adc
    ?? objectData.adc_val
    ?? decodedData.potenciometro
    ?? decodedData.adc
    ?? decodedData.adc_val;

  let tension = null;
  if (typeof rawTension === 'number' && Number.isFinite(rawTension)) {
    tension = Number(rawTension.toFixed(2));
  }

  // Extracción de corriente
  // El códec de ChirpStack (object/objectJSON) es autoritativo frente al
  // fallback binario. Esto también evita que un alias del binario opaque un
  // campo equivalente del objeto decodificado.
  const corrienteEnMa = objectData.corriente_medida_ma
    ?? objectData.corriente_actual_ma
    ?? objectData.corriente_mA
    ?? objectData.corriente_ma
    ?? objectData.ma
    ?? decodedData.corriente_medida_ma
    ?? decodedData.corriente_actual_ma
    ?? decodedData.corriente_mA
    ?? decodedData.corriente_ma
    ?? decodedData.ma;
  const corrienteEnA = objectData.corriente_A
    ?? objectData.corriente_a
    ?? decodedData.corriente_A
    ?? decodedData.corriente_a;
  let corriente = corrienteEnMa ?? (
    typeof corrienteEnA === 'number' && Number.isFinite(corrienteEnA)
      ? corrienteEnA * 1000
      : objectData.corriente
        ?? objectData.current
        ?? objectData.amperaje
        ?? objectData.i
        ?? decodedData.corriente
        ?? decodedData.current
        ?? decodedData.amperaje
        ?? decodedData.i
  );

  // Si la corriente viene en Amperes decimales (ej: 0.45A), convertir a mA
  if (corrienteEnMa === undefined && typeof corriente === 'number' && corriente > 0 && corriente < 20) {
    corriente = Math.round(corriente * 1000);
  }

  // Extracción de fase
  const faseRaw = String(objectData.fase ?? decodedData.fase ?? '').trim().toUpperCase();
  const fase = ['L1', 'L2', 'L3'].includes(faseRaw) ? faseRaw : null;

  const corrientePrevia = objectData.corriente_previa_ma
    ?? objectData.corriente_anterior_ma
    ?? decodedData.corriente_previa_ma
    ?? decodedData.corriente_anterior_ma;
  const tiempoCaidaMs = objectData.tiempo_caida_ms ?? decodedData.tiempo_caida_ms;

  return {
    tension,
    corriente: typeof corriente === 'number' && Number.isFinite(corriente) ? Number(corriente.toFixed(2)) : null,
    corrientePrevia: typeof corrientePrevia === 'number' && Number.isFinite(corrientePrevia) ? corrientePrevia : null,
    tiempoCaidaMs: typeof tiempoCaidaMs === 'number' && Number.isFinite(tiempoCaidaMs) ? tiempoCaidaMs : null,
    fase,
    focoAfectado: objectData.id_foco ?? objectData.foco ?? decodedData.id_foco ?? decodedData.foco ?? null,
    estadoCircuito: objectData.estado_circuito ?? decodedData.estado_circuito ?? null,
    rawObject: merged,
    rawPotenciometro,
    sensorVoltaje: objectData.voltaje ?? decodedData.voltaje,
  };
}

/**
 * Transforma un cuerpo de uplink de ChirpStack en un evento válido para ingestEvent().
 */
function adaptChirpstackUplink(body, query = {}, headers = {}) {
  ({ body } = unwrapChirpstackUplink(body));
  const deviceInfo = body.deviceInfo || {};
  const devEui = deviceInfo.devEui || deviceInfo.devEUI || body.devEUI || body.devEui || '';
  const deviceName = deviceInfo.deviceName || body.deviceName || 'ArduinoRFM95_v2';
  const idTablero = resolveTableroId(deviceInfo, devEui);

  const { rssi, snr } = extractRadioMetrics(body.rxInfo, body);
  const {
    tension,
    corriente,
    corrientePrevia,
    tiempoCaidaMs,
    estadoCircuito,
    fase,
    focoAfectado,
    rawObject,
    rawPotenciometro,
    sensorVoltaje,
  } = extractMeasurements(body);
  if (!Number.isFinite(tension) && !Number.isFinite(corriente)) {
    throw new Error('El uplink no contiene una medición válida de corriente.');
  }

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

  if (Number.isFinite(tension) && tension < 190.0) {
    tipoEvento = 'BAJA_TENSION';
    severidad = 'CRITICA';
    datos = {
      tension_medida_v: tension,
      tension_nominal_v: 220.0,
      umbral_minimo_v: 190.0,
      ...(fase ? { fase } : {}),
      ...(Number.isFinite(corriente) ? { corriente_medida_ma: corriente, corriente_actual_ma: corriente } : {}),
      ...(rssi !== null ? { rssi_lora: rssi } : {}),
      estado_conexion: 'ONLINE',
    };
  } else if (Number.isFinite(corriente) && corriente < MIN_ACCEPTABLE_CURRENT_MA) {
    tipoEvento = 'BAJA_CORRIENTE';
    severidad = 'CRITICA';
    datos = {
      corriente_medida_ma: corriente,
      corriente_actual_ma: corriente,
      umbral_minimo_ma: MIN_ACCEPTABLE_CURRENT_MA,
      ...(fase ? { fase } : {}),
      ...(rssi !== null ? { rssi_lora: rssi } : {}),
      estado_conexion: 'ONLINE',
    };
  } else if (Number.isFinite(corriente) && corriente > MAX_ACCEPTABLE_CURRENT_MA) {
    tipoEvento = 'SOBRECORRIENTE';
    severidad = 'CRITICA';
    datos = {
      corriente_medida_ma: corriente,
      corriente_actual_ma: corriente,
      umbral_maximo_ma: MAX_ACCEPTABLE_CURRENT_MA,
      ...(fase ? { fase } : {}),
      ...(rssi !== null ? { rssi_lora: rssi } : {}),
      estado_conexion: 'ONLINE',
    };
  } else if (
    focoAfectado &&
    Number.isFinite(corriente) && corriente < MIN_ACCEPTABLE_CURRENT_MA &&
    Number.isFinite(corrientePrevia) && corrientePrevia >= MIN_ACCEPTABLE_CURRENT_MA &&
    Number.isFinite(tiempoCaidaMs) && tiempoCaidaMs <= 200 &&
    estadoCircuito === 'ACTIVO'
  ) {
    tipoEvento = 'DESCONEXION_ABRUPTA_FOCO';
    severidad = 'CRITICA';
    datos = {
      id_foco: String(focoAfectado),
      corriente_previa_ma: corrientePrevia,
      corriente_actual_ma: corriente,
      tiempo_caida_ms: tiempoCaidaMs,
      estado_circuito: 'ACTIVO',
      ...(Number.isFinite(tension) ? { tension_medida_v: tension, tension_nominal_v: 220.0 } : {}),
      ...(fase ? { fase } : {}),
      ...(rssi !== null ? { rssi_lora: rssi } : {}),
      estado_conexion: 'ONLINE',
    };
  } else {
    // Caso normal
    datos = {
      ...(Number.isFinite(tension) ? { tension_medida_v: tension, tension_nominal_v: 220.0 } : {}),
      ...(fase ? { fase } : {}),
      ...(Number.isFinite(corriente) ? { corriente_medida_ma: corriente, corriente_actual_ma: corriente } : {}),
      ...(rssi !== null ? { rssi_lora: rssi } : {}),
      estado_conexion: 'ONLINE',
    };
  }

  const normalizedEvent = {
    tipo_evento: tipoEvento,
    id_tablero: idTablero,
    timestamp,
    severidad,
    ...(typeof body.ubicacion === 'string' && body.ubicacion.trim()
      ? { ubicacion: body.ubicacion.trim() }
      : {}),
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
  unwrapChirpstackUplink,
  resolveTableroId,
  decodeBase64Payload,
  extractRadioMetrics,
};
