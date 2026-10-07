BEGIN;

-- Semilla de usuarios iniciales (admin y técnico)
-- Contraseña por defecto: password123 (scrypt)
INSERT INTO usuarios (nombre, email, password_hash, rol)
VALUES 
  ('Administrador Municipal', 'admin@neuquen.gob.ar', 'a1b2c3d4e5f60718293a4b5c6d7e8f90:bd2a0d77b0b3bb3fb91967ef947b311b65783ebacd8eaaa0b773bee021252e0c186602982b6ef9824ffdac2449f9d5f9bdc892479778e2d6c2c9e748927e4c12', 'admin'),
  ('Técnico de Guardia', 'tecnico@neuquen.gob.ar', 'a1b2c3d4e5f60718293a4b5c6d7e8f90:bd2a0d77b0b3bb3fb91967ef947b311b65783ebacd8eaaa0b773bee021252e0c186602982b6ef9824ffdac2449f9d5f9bdc892479778e2d6c2c9e748927e4c12', 'tecnico')
ON CONFLICT (email) DO UPDATE SET
  rol = EXCLUDED.rol;

COMMIT;
