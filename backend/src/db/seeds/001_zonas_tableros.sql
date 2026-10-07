BEGIN;

INSERT INTO zonas (nombre_zona, tipo_espacio, descripcion)
VALUES
  ('Parque Central', 'parque', 'Parque Central de Neuquén, sobre Avenida Olascoaga'),
  ('Parque Jaime de Nevares', 'parque', 'Parque Jaime de Nevares, predio de la ex U9'),
  ('Plaza de las Banderas', 'plaza', 'Plaza de las Banderas, extremo norte de Avenida Argentina'),
  ('Paseo de la Costa', 'costanera', 'Paseo de la Costa - Río Limay')
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
    (SELECT id_zona FROM zonas WHERE nombre_zona = 'Parque Central'),
    'Parque Central',
    'Parque Central - Avenida Olascoaga',
    26.7, 46.8, 'L1', 220.00, 'ok'
  ),
  (
    'TABLERO_02',
    (SELECT id_zona FROM zonas WHERE nombre_zona = 'Parque Jaime de Nevares'),
    'Parque Jaime de Nevares',
    'Parque Jaime de Nevares - ex U9',
    41.2, 56.6, 'L2', 220.00, 'ok'
  ),
  (
    'TABLERO_03',
    (SELECT id_zona FROM zonas WHERE nombre_zona = 'Plaza de las Banderas'),
    'Plaza de las Banderas',
    'Plaza de las Banderas - Avenida Argentina',
    26.2, 84.5, 'L3', 220.00, 'ok'
  ),
  (
    'TABLERO_04',
    (SELECT id_zona FROM zonas WHERE nombre_zona = 'Paseo de la Costa'),
    'Paseo de la Costa',
    'Paseo de la Costa - Río Limay',
    36.2, 8.7, 'L1', 220.00, 'ok'
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
