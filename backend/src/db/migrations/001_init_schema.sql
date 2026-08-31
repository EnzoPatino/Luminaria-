BEGIN;

CREATE TABLE IF NOT EXISTS zonas (
  id_zona SERIAL PRIMARY KEY,
  nombre_zona TEXT NOT NULL UNIQUE,
  tipo_espacio TEXT,
  descripcion TEXT
);

CREATE TABLE IF NOT EXISTS tableros (
  id_tablero TEXT PRIMARY KEY,
  id_zona INTEGER REFERENCES zonas(id_zona) ON DELETE SET NULL,
  nombre_tablero TEXT,
  ubicacion TEXT,
  ubicacion_gps TEXT,
  pos_x REAL,
  pos_y REAL,
  fase TEXT,
  tension_nominal NUMERIC(6,2) NOT NULL DEFAULT 220.00,
  estado TEXT NOT NULL DEFAULT 'ok',
  fecha_instalacion DATE,
  CONSTRAINT tableros_fase_chk CHECK (fase IS NULL OR fase IN ('L1', 'L2', 'L3')),
  CONSTRAINT tableros_estado_chk CHECK (estado IN ('ok', 'advertencia', 'critico')),
  CONSTRAINT tableros_tension_nominal_chk CHECK (tension_nominal > 0)
);

CREATE TABLE IF NOT EXISTS sensores (
  id_sensor SERIAL PRIMARY KEY,
  id_tablero TEXT NOT NULL REFERENCES tableros(id_tablero) ON DELETE CASCADE,
  mac_esp32 TEXT UNIQUE,
  modulo_lora_id TEXT,
  topico_mqtt TEXT,
  umbral_tension_min NUMERIC(6,2) NOT NULL DEFAULT 190.00,
  umbral_tension_max NUMERIC(6,2),
  estado_sensor TEXT NOT NULL DEFAULT 'activo',
  fecha_instalacion DATE NOT NULL DEFAULT CURRENT_DATE,
  CONSTRAINT sensores_estado_chk CHECK (estado_sensor IN ('activo', 'inactivo', 'mantenimiento')),
  CONSTRAINT sensores_umbral_chk CHECK (
    umbral_tension_max IS NULL OR umbral_tension_max > umbral_tension_min
  )
);

CREATE INDEX IF NOT EXISTS idx_sensores_tablero ON sensores(id_tablero);

CREATE TABLE IF NOT EXISTS lecturas (
  id_lectura BIGSERIAL PRIMARY KEY,
  id_sensor INTEGER NOT NULL REFERENCES sensores(id_sensor) ON DELETE RESTRICT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  valor_tension NUMERIC(6,2),
  valor_corriente NUMERIC(8,2),
  fase TEXT,
  rssi_lora NUMERIC(5,1),
  estado_conexion TEXT,
  CONSTRAINT lecturas_tension_chk CHECK (valor_tension IS NULL OR valor_tension >= 0),
  CONSTRAINT lecturas_corriente_chk CHECK (valor_corriente IS NULL OR valor_corriente >= 0),
  CONSTRAINT lecturas_fase_chk CHECK (fase IS NULL OR fase IN ('L1', 'L2', 'L3'))
);

CREATE INDEX IF NOT EXISTS idx_lecturas_sensor_timestamp
  ON lecturas(id_sensor, timestamp);
CREATE INDEX IF NOT EXISTS idx_lecturas_timestamp
  ON lecturas(timestamp);

CREATE TABLE IF NOT EXISTS alertas (
  id_alerta BIGSERIAL PRIMARY KEY,
  id_tablero TEXT NOT NULL REFERENCES tableros(id_tablero) ON DELETE RESTRICT,
  id_lectura BIGINT REFERENCES lecturas(id_lectura) ON DELETE SET NULL,
  tipo_alerta TEXT NOT NULL,
  id_foco_afectado TEXT,
  ubicacion TEXT,
  fecha_hora_generada TIMESTAMPTZ NOT NULL DEFAULT now(),
  prioridad TEXT NOT NULL,
  estado_alerta TEXT NOT NULL DEFAULT 'activa',
  fecha_resolucion TIMESTAMPTZ,
  es_persistente BOOLEAN NOT NULL DEFAULT FALSE,
  datos_json JSONB,
  CONSTRAINT alertas_prioridad_chk CHECK (prioridad IN ('CRITICA', 'ADVERTENCIA', 'INFO')),
  CONSTRAINT alertas_estado_chk CHECK (estado_alerta IN ('activa', 'resuelta')),
  CONSTRAINT alertas_resolucion_chk CHECK (
    (estado_alerta = 'activa' AND fecha_resolucion IS NULL)
    OR
    (estado_alerta = 'resuelta' AND fecha_resolucion IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_alertas_tablero_fecha
  ON alertas(id_tablero, fecha_hora_generada DESC);
CREATE INDEX IF NOT EXISTS idx_alertas_fecha_persistencia
  ON alertas(fecha_hora_generada, es_persistente);
CREATE INDEX IF NOT EXISTS idx_alertas_lectura
  ON alertas(id_lectura);
CREATE INDEX IF NOT EXISTS idx_alertas_activas_tablero
  ON alertas(id_tablero, prioridad)
  WHERE estado_alerta = 'activa';

CREATE TABLE IF NOT EXISTS estadisticas_zona (
  id_estadistica BIGSERIAL PRIMARY KEY,
  id_zona INTEGER NOT NULL REFERENCES zonas(id_zona) ON DELETE CASCADE,
  periodo_dia DATE NOT NULL,
  tension_minima NUMERIC(6,2),
  tension_maxima NUMERIC(6,2),
  tension_promedio NUMERIC(6,2),
  cantidad_lecturas INTEGER NOT NULL DEFAULT 0,
  fecha_calculo TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id_zona, periodo_dia),
  CONSTRAINT estadisticas_cantidad_chk CHECK (cantidad_lecturas >= 0)
);

CREATE INDEX IF NOT EXISTS idx_estadisticas_zona_periodo
  ON estadisticas_zona(id_zona, periodo_dia DESC);

COMMIT;
