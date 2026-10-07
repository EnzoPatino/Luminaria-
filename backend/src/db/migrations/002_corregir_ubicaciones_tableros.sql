BEGIN;

-- pos_x/pos_y son porcentajes del área geográfica que convierte el mapa.
-- Cada tablero de demostración queda anclado a un espacio verde de Neuquén.
INSERT INTO zonas (nombre_zona, tipo_espacio, descripcion)
VALUES
  ('Parque Central', 'parque', 'Parque Central de Neuquén, sobre Avenida Olascoaga'),
  ('Parque Jaime de Nevares', 'parque', 'Parque Jaime de Nevares, predio de la ex U9'),
  ('Plaza de las Banderas', 'plaza', 'Plaza de las Banderas, extremo norte de Avenida Argentina'),
  ('Paseo de la Costa', 'costanera', 'Paseo de la Costa - Río Limay')
ON CONFLICT (nombre_zona) DO UPDATE SET
  tipo_espacio = EXCLUDED.tipo_espacio,
  descripcion = EXCLUDED.descripcion;

UPDATE tableros
SET id_zona = (
      SELECT z.id_zona
      FROM zonas z
      WHERE z.nombre_zona = CASE tableros.id_tablero
        WHEN 'TABLERO_01' THEN 'Parque Central'
        WHEN 'TABLERO_02' THEN 'Parque Jaime de Nevares'
        WHEN 'TABLERO_03' THEN 'Plaza de las Banderas'
        WHEN 'TABLERO_04' THEN 'Paseo de la Costa'
      END
    ),
    nombre_tablero = CASE id_tablero
      WHEN 'TABLERO_01' THEN 'Parque Central'
      WHEN 'TABLERO_02' THEN 'Parque Jaime de Nevares'
      WHEN 'TABLERO_03' THEN 'Plaza de las Banderas'
      WHEN 'TABLERO_04' THEN 'Paseo de la Costa'
      ELSE nombre_tablero
    END,
    ubicacion = CASE id_tablero
      WHEN 'TABLERO_01' THEN 'Parque Central - Avenida Olascoaga'
      WHEN 'TABLERO_02' THEN 'Parque Jaime de Nevares - ex U9'
      WHEN 'TABLERO_03' THEN 'Plaza de las Banderas - Avenida Argentina'
      WHEN 'TABLERO_04' THEN 'Paseo de la Costa - Río Limay'
      ELSE ubicacion
    END,
    pos_x = CASE id_tablero
      WHEN 'TABLERO_01' THEN 26.7
      WHEN 'TABLERO_02' THEN 41.2
      WHEN 'TABLERO_03' THEN 26.2
      WHEN 'TABLERO_04' THEN 36.2
      ELSE pos_x
    END,
    pos_y = CASE id_tablero
      WHEN 'TABLERO_01' THEN 46.8
      WHEN 'TABLERO_02' THEN 56.6
      WHEN 'TABLERO_03' THEN 84.5
      WHEN 'TABLERO_04' THEN 8.7
      ELSE pos_y
    END
WHERE id_tablero IN ('TABLERO_01', 'TABLERO_02', 'TABLERO_03', 'TABLERO_04');

COMMIT;
