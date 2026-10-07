BEGIN;

-- Semillas para ADMIN y TECNICO según DER
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

INSERT INTO admin_tecnico (id_admin, id_tecnico)
SELECT a.id, t.id
FROM admin a, tecnico t
WHERE a.usuario = 'admin' AND t.usuario = 'tecnico'
ON CONFLICT (id_admin, id_tecnico) DO NOTHING;

COMMIT;
