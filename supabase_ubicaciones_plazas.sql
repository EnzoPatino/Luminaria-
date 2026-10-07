-- Ejecutar en Supabase SQL Editor para mover los tableros de demostración
-- a las plazas y parques que deben marcarse durante la simulación.
UPDATE public.tableros
SET nombre_tablero = CASE id_tablero
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
