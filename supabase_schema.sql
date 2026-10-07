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

-- 7. TABLA: usuarios (BE-04: Autenticación y RBAC con roles 'admin' y 'tecnico')
CREATE TABLE IF NOT EXISTS public.usuarios (
  id_usuario SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  rol TEXT NOT NULL DEFAULT 'tecnico',
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT usuarios_rol_chk CHECK (rol IN ('admin', 'tecnico')),
  CONSTRAINT usuarios_email_chk CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z]{2,}$')
);

-- Migración idempotente de roles si la tabla ya existía
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'usuarios') THEN
    UPDATE public.usuarios SET rol = 'tecnico' WHERE rol NOT IN ('admin', 'tecnico');
    ALTER TABLE public.usuarios DROP CONSTRAINT IF EXISTS usuarios_rol_chk;
    ALTER TABLE public.usuarios ADD CONSTRAINT usuarios_rol_chk CHECK (rol IN ('admin', 'tecnico'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_usuarios_email ON public.usuarios(email);
CREATE INDEX IF NOT EXISTS idx_usuarios_rol ON public.usuarios(rol);

-- 8. TABLA: audit_log (SEC-03: Auditoría y trazabilidad)
CREATE TABLE IF NOT EXISTS public.audit_log (
  id_audit BIGSERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  id_usuario INTEGER REFERENCES public.usuarios(id_usuario) ON DELETE SET NULL,
  accion TEXT NOT NULL,
  recurso TEXT NOT NULL,
  id_recurso TEXT,
  ip_origen TEXT,
  detalles JSONB,
  correlation_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON public.audit_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_usuario ON public.audit_log(id_usuario);
CREATE INDEX IF NOT EXISTS idx_audit_accion ON public.audit_log(accion);

-- 9. SEGURIDAD RLS PARA USUARIOS Y AUDIT
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura usuarios autenticados" ON public.usuarios;
CREATE POLICY "Lectura usuarios autenticados" ON public.usuarios FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS "Lectura audit_log autenticados" ON public.audit_log;
CREATE POLICY "Lectura audit_log autenticados" ON public.audit_log FOR SELECT TO authenticated USING (true);

-- 10. SEMILLAS DE USUARIOS INICIALES (admin y técnico)
-- Contraseña por defecto: password123 (scrypt)
INSERT INTO public.usuarios (nombre, email, password_hash, rol)
VALUES 
  ('Administrador Municipal', 'admin@neuquen.gob.ar', 'a1b2c3d4e5f60718293a4b5c6d7e8f90:bd2a0d77b0b3bb3fb91967ef947b311b65783ebacd8eaaa0b773bee021252e0c186602982b6ef9824ffdac2449f9d5f9bdc892479778e2d6c2c9e748927e4c12', 'admin'),
  ('Técnico de Guardia', 'tecnico@neuquen.gob.ar', 'a1b2c3d4e5f60718293a4b5c6d7e8f90:bd2a0d77b0b3bb3fb91967ef947b311b65783ebacd8eaaa0b773bee021252e0c186602982b6ef9824ffdac2449f9d5f9bdc892479778e2d6c2c9e748927e4c12', 'tecnico')
ON CONFLICT (email) DO UPDATE SET
  rol = EXCLUDED.rol;
