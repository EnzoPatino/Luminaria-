-- Migración 002: Tabla de usuarios (BE-04) y audit_log (SEC-03)
BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- BE-04: Tabla de usuarios para autenticación JWT y control de acceso RBAC.
-- Los roles válidos son 'admin' y 'tecnico'.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS usuarios (
  id_usuario    SERIAL PRIMARY KEY,
  nombre        TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  rol           TEXT NOT NULL DEFAULT 'tecnico',
  activo        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT usuarios_rol_chk CHECK (rol IN ('admin', 'tecnico')),
  CONSTRAINT usuarios_email_chk CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z]{2,}$')
);

-- Si la tabla ya existía con roles anteriores ('supervisor'), migrar registros y actualizar restricción
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'usuarios') THEN
    UPDATE usuarios SET rol = 'tecnico' WHERE rol NOT IN ('admin', 'tecnico');
    ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_rol_chk;
    ALTER TABLE usuarios ADD CONSTRAINT usuarios_rol_chk CHECK (rol IN ('admin', 'tecnico'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);
CREATE INDEX IF NOT EXISTS idx_usuarios_rol   ON usuarios(rol);

-- Usuarios iniciales por defecto (admin y técnico)
-- Contraseña por defecto: password123 (scrypt)
INSERT INTO usuarios (nombre, email, password_hash, rol)
VALUES 
  ('Administrador Municipal', 'admin@neuquen.gob.ar', 'a1b2c3d4e5f60718293a4b5c6d7e8f90:bd2a0d77b0b3bb3fb91967ef947b311b65783ebacd8eaaa0b773bee021252e0c186602982b6ef9824ffdac2449f9d5f9bdc892479778e2d6c2c9e748927e4c12', 'admin'),
  ('Técnico de Guardia', 'tecnico@neuquen.gob.ar', 'a1b2c3d4e5f60718293a4b5c6d7e8f90:bd2a0d77b0b3bb3fb91967ef947b311b65783ebacd8eaaa0b773bee021252e0c186602982b6ef9824ffdac2449f9d5f9bdc892479778e2d6c2c9e748927e4c12', 'tecnico')
ON CONFLICT (email) DO UPDATE SET
  rol = EXCLUDED.rol;

-- ─────────────────────────────────────────────────────────────────────────────
-- SEC-03: Audit log para registrar acciones sensibles (logins, resolución de
-- alertas, cambios de rol, etc.). Permite trazabilidad completa.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id_audit      BIGSERIAL PRIMARY KEY,
  timestamp     TIMESTAMPTZ NOT NULL DEFAULT now(),
  id_usuario    INTEGER REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
  accion        TEXT NOT NULL,
  recurso       TEXT NOT NULL,
  id_recurso    TEXT,
  ip_origen     TEXT,
  detalles      JSONB,
  correlation_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_timestamp   ON audit_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_usuario      ON audit_log(id_usuario);
CREATE INDEX IF NOT EXISTS idx_audit_accion       ON audit_log(accion);
CREATE INDEX IF NOT EXISTS idx_audit_correlation  ON audit_log(correlation_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Añadir columna de técnico resolutor a la tabla de alertas existente
-- para asociar quién resolvió cada alerta.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE alertas ADD COLUMN IF NOT EXISTS resuelto_por INTEGER REFERENCES usuarios(id_usuario) ON DELETE SET NULL;

COMMIT;
