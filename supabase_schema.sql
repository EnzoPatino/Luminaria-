-- ====================================================================
-- SISTEMA LUMINARIA - MUNICIPALIDAD DE NEUQUÉN
-- Script DDL de Base de Datos para Supabase (PostgreSQL Cloud)
-- Diseñado por Arquitectura de Base de Datos Senior
-- ====================================================================

-- 1. TABLA: tableros
-- Almacena los tableros de alumbrado público, coordenadas y estado eléctrico en vivo
CREATE TABLE IF NOT EXISTS public.tableros (
  id_tablero TEXT PRIMARY KEY,
  nombre_tablero TEXT NOT NULL,
  ubicacion TEXT NOT NULL,
  pos_x REAL NOT NULL DEFAULT 50,
  pos_y REAL NOT NULL DEFAULT 50,
  fase TEXT CHECK (fase IS NULL OR fase IN ('L1', 'L2', 'L3')),
  tension_nominal NUMERIC(6,2) NOT NULL DEFAULT 220.00,
  tension_medida_v NUMERIC(6,2) NOT NULL DEFAULT 220.00,
  estado TEXT NOT NULL DEFAULT 'ok' CHECK (estado IN ('ok', 'advertencia', 'critico')),
  focos JSONB NOT NULL DEFAULT '{}'::jsonb,
  ultima_actualizacion TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. TABLA: alertas
-- Registro inmutable e histórico de fallas, caídas de tensión y anomalías
CREATE TABLE IF NOT EXISTS public.alertas (
  id_alerta BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_tablero TEXT NOT NULL REFERENCES public.tableros(id_tablero) ON DELETE CASCADE,
  tipo_evento TEXT NOT NULL,
  prioridad TEXT NOT NULL CHECK (prioridad IN ('CRITICA', 'ADVERTENCIA', 'INFO')),
  titulo TEXT NOT NULL,
  ubicacion TEXT,
  datos_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  estado_alerta TEXT NOT NULL DEFAULT 'activa' CHECK (estado_alerta IN ('activa', 'resuelta')),
  fecha_hora_generada TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_resolucion TIMESTAMPTZ,
  tecnico_resolucion TEXT
);

-- 3. ÍNDICES DE ALTO RENDIMIENTO
CREATE INDEX IF NOT EXISTS idx_alertas_estado_fecha 
  ON public.alertas (estado_alerta, fecha_hora_generada DESC);

CREATE INDEX IF NOT EXISTS idx_alertas_tablero 
  ON public.alertas (id_tablero);

CREATE INDEX IF NOT EXISTS idx_alertas_datos_gin 
  ON public.alertas USING gin (datos_json);

CREATE INDEX IF NOT EXISTS idx_tableros_estado 
  ON public.tableros (estado);

-- 4. SEGURIDAD A NIVEL DE FILAS (Row Level Security - RLS)
ALTER TABLE public.tableros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alertas ENABLE ROW LEVEL SECURITY;

-- Políticas permisivas para la aplicación web (anon y authenticated)
DROP POLICY IF EXISTS "Lectura publica tableros" ON public.tableros;
CREATE POLICY "Lectura publica tableros" 
  ON public.tableros FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Actualizacion publica tableros" ON public.tableros;
CREATE POLICY "Actualizacion publica tableros" 
  ON public.tableros FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Lectura publica alertas" ON public.alertas;
CREATE POLICY "Lectura publica alertas" 
  ON public.alertas FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Insercion publica alertas" ON public.alertas;
CREATE POLICY "Insercion publica alertas" 
  ON public.alertas FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Actualizacion publica alertas" ON public.alertas;
CREATE POLICY "Actualizacion publica alertas" 
  ON public.alertas FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- 5. HABILITACIÓN DE SUPABASE REALTIME
-- Permite que los cambios se transmitan instantáneamente por WebSockets a todos los operadores
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tableros;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.alertas;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;

-- 6. SEMILLAS (Datos Iniciales de Tableros de la Ciudad de Neuquén)
INSERT INTO public.tableros (
  id_tablero, nombre_tablero, ubicacion, pos_x, pos_y, fase, tension_nominal, tension_medida_v, estado, focos
) VALUES 
(
  'TABLERO_01', 
  'Centro / Palacio Municipal', 
  'Centro / Palacio Municipal', 
  20, 45, 'L1', 220.00, 220.00, 'ok',
  '{"FOCO_A1":{"id":"FOCO_A1","corriente_ma":450,"estado":"ok"},"FOCO_A2":{"id":"FOCO_A2","corriente_ma":450,"estado":"ok"},"FOCO_A3":{"id":"FOCO_A3","corriente_ma":450,"estado":"ok"},"FOCO_A4":{"id":"FOCO_A4","corriente_ma":450,"estado":"ok"}}'::jsonb
),
(
  'TABLERO_02', 
  'Parque Norte', 
  'Parque Norte - Sector Canchas', 
  45, 30, 'L2', 220.00, 220.00, 'ok',
  '{"FOCO_B1":{"id":"FOCO_B1","corriente_ma":450,"estado":"ok"},"FOCO_B2":{"id":"FOCO_B2","corriente_ma":450,"estado":"ok"},"FOCO_B3":{"id":"FOCO_B3","corriente_ma":450,"estado":"ok"}}'::jsonb
),
(
  'TABLERO_03', 
  'Paseo de la Costa', 
  'Paseo de la Costa - Río Limay', 
  75, 75, 'L3', 220.00, 220.00, 'ok',
  '{"FOCO_C1":{"id":"FOCO_C1","corriente_ma":450,"estado":"ok"},"FOCO_C2":{"id":"FOCO_C2","corriente_ma":450,"estado":"ok"}}'::jsonb
),
(
  'TABLERO_04', 
  'Avenida Argentina', 
  'Av. Argentina y Monolito', 
  55, 50, 'L1', 220.00, 220.00, 'ok',
  '{"FOCO_D1":{"id":"FOCO_D1","corriente_ma":450,"estado":"ok"},"FOCO_D2":{"id":"FOCO_D2","corriente_ma":450,"estado":"ok"}}'::jsonb
)
ON CONFLICT (id_tablero) DO UPDATE SET
  nombre_tablero = EXCLUDED.nombre_tablero,
  ubicacion = EXCLUDED.ubicacion,
  pos_x = EXCLUDED.pos_x,
  pos_y = EXCLUDED.pos_y,
  fase = EXCLUDED.fase,
  tension_nominal = EXCLUDED.tension_nominal;
