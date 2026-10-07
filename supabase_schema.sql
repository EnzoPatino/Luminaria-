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
  'Parque Central',
  'Parque Central - Avenida Olascoaga',
  26.7, 46.8, 'L1', 220.00, 220.00, 'ok',
  '{"FOCO_A1":{"id":"FOCO_A1","corriente_ma":450,"estado":"ok"},"FOCO_A2":{"id":"FOCO_A2","corriente_ma":450,"estado":"ok"},"FOCO_A3":{"id":"FOCO_A3","corriente_ma":450,"estado":"ok"},"FOCO_A4":{"id":"FOCO_A4","corriente_ma":450,"estado":"ok"}}'::jsonb
),
(
  'TABLERO_02', 
  'Parque Jaime de Nevares',
  'Parque Jaime de Nevares - ex U9',
  41.2, 56.6, 'L2', 220.00, 220.00, 'ok',
  '{"FOCO_B1":{"id":"FOCO_B1","corriente_ma":450,"estado":"ok"},"FOCO_B2":{"id":"FOCO_B2","corriente_ma":450,"estado":"ok"},"FOCO_B3":{"id":"FOCO_B3","corriente_ma":450,"estado":"ok"}}'::jsonb
),
(
  'TABLERO_03', 
  'Plaza de las Banderas',
  'Plaza de las Banderas - Avenida Argentina',
  26.2, 84.5, 'L3', 220.00, 220.00, 'ok',
  '{"FOCO_C1":{"id":"FOCO_C1","corriente_ma":450,"estado":"ok"},"FOCO_C2":{"id":"FOCO_C2","corriente_ma":450,"estado":"ok"}}'::jsonb
),
(
  'TABLERO_04', 
  'Paseo de la Costa',
  'Paseo de la Costa - Río Limay',
  36.2, 8.7, 'L1', 220.00, 220.00, 'ok',
  '{"FOCO_D1":{"id":"FOCO_D1","corriente_ma":450,"estado":"ok"},"FOCO_D2":{"id":"FOCO_D2","corriente_ma":450,"estado":"ok"}}'::jsonb
)
ON CONFLICT (id_tablero) DO UPDATE SET
  nombre_tablero = EXCLUDED.nombre_tablero,
  ubicacion = EXCLUDED.ubicacion,
  pos_x = EXCLUDED.pos_x,
  pos_y = EXCLUDED.pos_y,
  fase = EXCLUDED.fase,
  tension_nominal = EXCLUDED.tension_nominal;

-- 7. TABLA: TECNICO (según DER)
CREATE TABLE IF NOT EXISTS public.tecnico (
  id SERIAL PRIMARY KEY,
  nom TEXT NOT NULL,
  apellido TEXT NOT NULL,
  dni TEXT NOT NULL UNIQUE,
  telefono TEXT,
  email TEXT NOT NULL UNIQUE,
  usuario TEXT NOT NULL UNIQUE,
  contraseña TEXT NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tecnico_usuario ON public.tecnico(usuario);
CREATE INDEX IF NOT EXISTS idx_tecnico_email   ON public.tecnico(email);

-- 8. TABLA: ADMIN (según DER)
CREATE TABLE IF NOT EXISTS public.admin (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  apellido TEXT NOT NULL,
  usuario TEXT NOT NULL UNIQUE,
  contraseña TEXT NOT NULL,
  dni TEXT NOT NULL UNIQUE,
  telefono TEXT,
  email TEXT NOT NULL UNIQUE,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_usuario ON public.admin(usuario);
CREATE INDEX IF NOT EXISTS idx_admin_email   ON public.admin(email);

-- 9. TABLA: ADMIN_TECNICO (Relación N:M "gestiona" entre ADMIN y TECNICO)
CREATE TABLE IF NOT EXISTS public.admin_tecnico (
  id_admin INTEGER NOT NULL REFERENCES public.admin(id) ON DELETE CASCADE,
  id_tecnico INTEGER NOT NULL REFERENCES public.tecnico(id) ON DELETE CASCADE,
  fecha_asignacion TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id_admin, id_tecnico)
);

-- Vincular id_tecnico en alertas
ALTER TABLE public.alertas ADD COLUMN IF NOT EXISTS id_tecnico INTEGER REFERENCES public.tecnico(id) ON DELETE SET NULL;

-- 10. VISTA: usuarios (para compatibilidad de backend y JWT)
CREATE OR REPLACE VIEW public.usuarios AS
SELECT 
  id AS id_usuario,
  id,
  nombre,
  apellido,
  dni,
  telefono,
  usuario,
  email,
  contraseña AS password_hash,
  'admin'::text AS rol,
  activo,
  created_at
FROM public.admin
UNION ALL
SELECT 
  id AS id_usuario,
  id,
  nom AS nombre,
  apellido,
  dni,
  telefono,
  usuario,
  email,
  contraseña AS password_hash,
  'tecnico'::text AS rol,
  activo,
  created_at
FROM public.tecnico;

-- 11. AUDIT_LOG
CREATE TABLE IF NOT EXISTS public.audit_log (
  id_audit BIGSERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  id_usuario INTEGER,
  accion TEXT NOT NULL,
  recurso TEXT NOT NULL,
  id_recurso TEXT,
  ip_origen TEXT,
  detalles JSONB,
  correlation_id TEXT
);

-- 12. SEGURIDAD RLS
ALTER TABLE public.tecnico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_tecnico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura publica tecnico" ON public.tecnico;
CREATE POLICY "Lectura publica tecnico" ON public.tecnico FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS "Lectura publica admin" ON public.admin;
CREATE POLICY "Lectura publica admin" ON public.admin FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS "Lectura publica admin_tecnico" ON public.admin_tecnico;
CREATE POLICY "Lectura publica admin_tecnico" ON public.admin_tecnico FOR SELECT TO authenticated, anon USING (true);

-- 13. SEMILLAS INICIALES (admin y técnico)
INSERT INTO public.admin (nombre, apellido, usuario, contraseña, dni, telefono, email)
VALUES (
  'Administrador',
  'Municipal',
  'admin',
  'a1b2c3d4e5f60718293a4b5c6d7e8f90:bd2a0d77b0b3bb3fb91967ef947b311b65783ebacd8eaaa0b773bee021252e0c186602982b6ef9824ffdac2449f9d5f9bdc892479778e2d6c2c9e748927e4c12',
  '12345678',
  '299-1234567',
  'admin@neuquen.gob.ar'
)
ON CONFLICT (usuario) DO NOTHING;

INSERT INTO public.tecnico (nom, apellido, dni, telefono, email, usuario, contraseña)
VALUES (
  'Técnico',
  'De Guardia',
  '87654321',
  '299-7654321',
  'tecnico@neuquen.gob.ar',
  'tecnico',
  'a1b2c3d4e5f60718293a4b5c6d7e8f90:bd2a0d77b0b3bb3fb91967ef947b311b65783ebacd8eaaa0b773bee021252e0c186602982b6ef9824ffdac2449f9d5f9bdc892479778e2d6c2c9e748927e4c12'
)
ON CONFLICT (usuario) DO NOTHING;

INSERT INTO public.admin_tecnico (id_admin, id_tecnico)
SELECT a.id, t.id
FROM public.admin a, public.tecnico t
WHERE a.usuario = 'admin' AND t.usuario = 'tecnico'
ON CONFLICT (id_admin, id_tecnico) DO NOTHING;
