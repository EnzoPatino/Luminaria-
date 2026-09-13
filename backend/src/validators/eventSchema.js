const { z } = require('zod');
const { IngestionError } = require('../errors/ingestionError');

const ROOT_KEYS = new Set([
  'tipo_evento',
  'id_tablero',
  'timestamp',
  'datos',
  'severidad',
  'ubicacion',
]);

const EVENT_SCHEMAS = {
  BAJA_TENSION: {
    severidades: ['CRITICA'],
    campos: z.object({
      tension_medida_v: z.number().min(0).max(1000),
      tension_nominal_v: z.number().min(1).max(1000),
      umbral_minimo_v: z.number().min(1).max(1000),
      fase: z.enum(['L1', 'L2', 'L3']),
      corriente_actual_ma: z.number().min(0).max(100000).optional(),
      corriente_medida_ma: z.number().min(0).max(100000).optional(),
      rssi_lora: z.number().min(-150).max(20).optional(),
      estado_conexion: z.string().max(50).optional(),
    }).strict(),
  },
  DESCONEXION_ABRUPTA_FOCO: {
    severidades: ['CRITICA'],
    campos: z.object({
      id_foco: z.string().trim().min(1).max(80),
      corriente_previa_ma: z.number().min(0).max(100000),
      corriente_actual_ma: z.number().min(0).max(100000),
      tiempo_caida_ms: z.number().int().min(0).max(60000),
      estado_circuito: z.enum(['ACTIVO', 'INACTIVO']),
      tension_medida_v: z.number().min(0).max(1000).optional(),
      tension_nominal_v: z.number().min(1).max(1000).optional(),
      fase: z.enum(['L1', 'L2', 'L3']).optional(),
      rssi_lora: z.number().min(-150).max(20).optional(),
      estado_conexion: z.string().max(50).optional(),
    }).strict(),
  },
  FOCO_QUEMADO: {
    severidades: ['ADVERTENCIA'],
    campos: z.object({
      id_foco: z.string().trim().min(1).max(80),
      corriente_esperada_ma: z.number().min(0).max(100000),
      corriente_medida_ma: z.number().min(0).max(100000),
      duracion_anomalia_s: z.number().int().min(0).max(86400),
      estado_circuito: z.enum(['ACTIVO', 'INACTIVO']),
      tension_medida_v: z.number().min(0).max(1000).optional(),
      tension_nominal_v: z.number().min(1).max(1000).optional(),
      fase: z.enum(['L1', 'L2', 'L3']).optional(),
      rssi_lora: z.number().min(-150).max(20).optional(),
      estado_conexion: z.string().max(50).optional(),
    }).strict(),
  },
  TELEMETRIA_NORMAL: {
    severidades: ['INFO'],
    campos: z.object({
      tension_medida_v: z.number().min(0).max(1000),
      tension_nominal_v: z.number().min(1).max(1000),
      fase: z.enum(['L1', 'L2', 'L3']),
      corriente_actual_ma: z.number().min(0).max(100000).optional(),
      corriente_medida_ma: z.number().min(0).max(100000).optional(),
      focos_restaurados: z.array(z.string().trim().min(1).max(80)).max(200).optional(),
      rssi_lora: z.number().min(-150).max(20).optional(),
      estado_conexion: z.string().max(50).optional(),
    }).strict(),
  },
};

const BaseEventSchema = z.object({
  tipo_evento: z.enum(Object.keys(EVENT_SCHEMAS)),
  id_tablero: z.string().trim().min(1).max(80),
  timestamp: z.string().datetime({ offset: true }).transform((val) => new Date(val).toISOString()),
  ubicacion: z.string().trim().min(1).max(180).optional().nullable(),
  severidad: z.string().optional().nullable(),
  datos: z.record(z.any()).optional().default({}),
}).passthrough();

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function assertKnownKeys(value, allowedKeys, path, errors) {
  Object.keys(value).forEach((key) => {
    if (!allowedKeys.has(key)) {
      errors.push({ path: `${path}.${key}`, message: 'Campo no permitido por el contrato JSON.' });
    }
  });
}

function validateAndNormalizeEvent(payload) {
  const errors = [];

  if (!isPlainObject(payload)) {
    throw new IngestionError('El payload debe ser un objeto JSON.', {
      code: 'INVALID_EVENT_CONTRACT',
      details: [{ path: '$', message: 'Debe ser un objeto JSON.' }],
    });
  }

  assertKnownKeys(payload, ROOT_KEYS, '$', errors);

  const parsedBase = BaseEventSchema.safeParse(payload);
  
  if (!parsedBase.success) {
    const zodErrors = parsedBase.error.issues.map(issue => ({
      path: issue.path.join('.'),
      message: issue.message
    }));
    throw new IngestionError('El payload no cumple el contrato JSON de ingesta.', {
      code: 'INVALID_EVENT_CONTRACT',
      details: [...errors, ...zodErrors],
    });
  }

  const { tipo_evento, id_tablero, timestamp, ubicacion, severidad, datos } = parsedBase.data;

  const schema = EVENT_SCHEMAS[tipo_evento];
  
  if (severidad && !schema.severidades.includes(severidad)) {
    errors.push({ path: 'severidad', message: `Debe ser uno de: ${schema.severidades.join(', ')}.` });
  }

  const parsedDatos = schema.campos.safeParse(datos);

  if (!parsedDatos.success) {
    const zodErrors = parsedDatos.error.issues.map(issue => ({
      path: `datos.${issue.path.join('.')}`,
      message: issue.message
    }));
    errors.push(...zodErrors);
  }

  if (errors.length > 0) {
    throw new IngestionError('El payload no cumple el contrato JSON de ingesta.', {
      code: 'INVALID_EVENT_CONTRACT',
      details: errors,
    });
  }

  return {
    tipo_evento,
    id_tablero,
    timestamp,
    datos: parsedDatos.data,
    severidad: severidad || schema.severidades[0], // fallback to first allowed severity if not provided, though the original local validator allowed null
    ubicacion: ubicacion || undefined,
  };
}

module.exports = {
  EVENT_SCHEMAS,
  validateAndNormalizeEvent,
};
