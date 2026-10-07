-- Migración 002: Tablas TECNICO, ADMIN, ADMIN_TECNICO (según DER) y audit_log
BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. TABLA: TECNICO (según DER)
-- Campos: id, nom, apellido, dni, teléfono, email, usuario, contraseña
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tecnico (
  id          SERIAL PRIMARY KEY,
  nom         TEXT NOT NULL,
  apellido    TEXT NOT NULL,
  dni         TEXT NOT NULL UNIQUE,
  telefono    TEXT,
  email       TEXT NOT NULL UNIQUE,
  usuario     TEXT NOT NULL UNIQUE,
  contraseña  TEXT NOT NULL,
  activo      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tecnico_usuario ON tecnico(usuario);
CREATE INDEX IF NOT EXISTS idx_tecnico_email   ON tecnico(email);
CREATE INDEX IF NOT EXISTS idx_tecnico_dni     ON tecnico(dni);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. TABLA: ADMIN (según DER)
-- Campos: id, nombre, apellido, usuario, contraseña, dni, teléfono, email
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin (
  id          SERIAL PRIMARY KEY,
  nombre      TEXT NOT NULL,
  apellido    TEXT NOT NULL,
  usuario     TEXT NOT NULL UNIQUE,
  contraseña  TEXT NOT NULL,
  dni         TEXT NOT NULL UNIQUE,
  telefono    TEXT,
  email       TEXT NOT NULL UNIQUE,
  activo      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_usuario ON admin(usuario);
CREATE INDEX IF NOT EXISTS idx_admin_email   ON admin(email);
CREATE INDEX IF NOT EXISTS idx_admin_dni     ON admin(dni);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. TABLA: ADMIN_TECNICO (Relación N:M "gestiona" entre ADMIN y TECNICO del DER)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_tecnico (
  id_admin         INTEGER NOT NULL REFERENCES admin(id) ON DELETE CASCADE,
  id_tecnico       INTEGER NOT NULL REFERENCES tecnico(id) ON DELETE CASCADE,
  fecha_asignacion TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id_admin, id_tecnico)
);

CREATE INDEX IF NOT EXISTS idx_admin_tecnico_admin   ON admin_tecnico(id_admin);
CREATE INDEX IF NOT EXISTS idx_admin_tecnico_tecnico ON admin_tecnico(id_tecnico);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. VINCULACIÓN EN ALERTAS: FK id_tecnico (según DER: ALERTA es atendida por TECNICO)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE alertas ADD COLUMN IF NOT EXISTS id_tecnico INTEGER REFERENCES tecnico(id) ON DELETE SET NULL;
ALTER TABLE alertas ADD COLUMN IF NOT EXISTS resuelto_por INTEGER;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. VISTA UNIFICADA: usuarios (para compatibilidad de autenticación y RBAC)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW usuarios AS
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
  created_at,
  updated_at
FROM admin
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
  created_at,
  updated_at
FROM tecnico;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. AUDIT_LOG: Auditoría de eventos de seguridad y operaciones críticas
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id_audit       BIGSERIAL PRIMARY KEY,
  timestamp      TIMESTAMPTZ NOT NULL DEFAULT now(),
  id_usuario     INTEGER,
  rol_usuario    TEXT,
  accion         TEXT NOT NULL,
  recurso        TEXT NOT NULL,
  id_recurso     TEXT,
  ip_origen      TEXT,
  detalles       JSONB,
  correlation_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_timestamp   ON audit_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_usuario     ON audit_log(id_usuario);
CREATE INDEX IF NOT EXISTS idx_audit_accion      ON audit_log(accion);
CREATE INDEX IF NOT EXISTS idx_audit_correlation ON audit_log(correlation_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. SEMILLAS POR DEFECTO: 1 Administrador y 1 Técnico iniciales (contraseña: password123)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO admin (nombre, apellido, usuario, contraseña, dni, telefono, email)
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

INSERT INTO tecnico (nom, apellido, dni, telefono, email, usuario, contraseña)
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

-- Relación N:M: El Administrador (id 1) gestiona al Técnico (id 1)
INSERT INTO admin_tecnico (id_admin, id_tecnico)
SELECT a.id, t.id
FROM admin a, tecnico t
WHERE a.usuario = 'admin' AND t.usuario = 'tecnico'
ON CONFLICT (id_admin, id_tecnico) DO NOTHING;

COMMIT;
