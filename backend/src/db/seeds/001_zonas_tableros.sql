BEGIN;

INSERT INTO zonas (nombre_zona, tipo_espacio, descripcion)
VALUES
  ('Centro / Palacio Municipal', 'via_publica', 'Centro de la ciudad y entorno del Palacio Municipal'),
  ('Parque Norte', 'parque', 'Parque Norte'),
  ('Paseo de la Costa', 'costanera', 'Paseo de la Costa - Río Limay'),
  ('Avenida Argentina', 'via_publica', 'Avenida Argentina')
ON CONFLICT (nombre_zona) DO UPDATE SET
  tipo_espacio = EXCLUDED.tipo_espacio,
  descripcion = EXCLUDED.descripcion;

INSERT INTO tableros (
  id_tablero, id_zona, nombre_tablero, ubicacion, pos_x, pos_y,
  fase, tension_nominal, estado
)
VALUES
  (
    'TABLERO_01',
    (SELECT id_zona FROM zonas WHERE nombre_zona = 'Centro / Palacio Municipal'),
    'Centro / Palacio Municipal',
    'Centro / Palacio Municipal',
    20, 45, 'L1', 220.00, 'ok'
  ),
  (
    'TABLERO_02',
    (SELECT id_zona FROM zonas WHERE nombre_zona = 'Parque Norte'),
    'Parque Norte',
    'Parque Norte - Sector Canchas',
    45, 30, 'L2', 220.00, 'ok'
  ),
  (
    'TABLERO_03',
    (SELECT id_zona FROM zonas WHERE nombre_zona = 'Paseo de la Costa'),
    'Paseo de la Costa',
    'Paseo de la Costa - Río Limay',
    75, 75, 'L3', 220.00, 'ok'
  ),
  (
    'TABLERO_04',
    (SELECT id_zona FROM zonas WHERE nombre_zona = 'Avenida Argentina'),
    'Avenida Argentina',
    'Av. Argentina y Monolito',
    55, 50, 'L1', 220.00, 'ok'
  )
ON CONFLICT (id_tablero) DO UPDATE SET
  id_zona = EXCLUDED.id_zona,
  nombre_tablero = EXCLUDED.nombre_tablero,
  ubicacion = EXCLUDED.ubicacion,
  pos_x = EXCLUDED.pos_x,
  pos_y = EXCLUDED.pos_y,
  fase = EXCLUDED.fase,
  tension_nominal = EXCLUDED.tension_nominal;

COMMIT;
