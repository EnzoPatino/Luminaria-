BEGIN;

ALTER TABLE lecturas
  ALTER COLUMN valor_corriente TYPE NUMERIC(8,3)
    USING valor_corriente::NUMERIC(8,3),
  ALTER COLUMN amperaje TYPE NUMERIC(8,3)
    USING amperaje::NUMERIC(8,3);

ALTER TABLE lecturas
  DROP CONSTRAINT IF EXISTS lecturas_corriente_chk,
  DROP CONSTRAINT IF EXISTS lecturas_amperaje_chk;

ALTER TABLE lecturas
  ADD CONSTRAINT lecturas_corriente_chk
    CHECK (valor_corriente IS NULL OR valor_corriente BETWEEN 0 AND 50) NOT VALID,
  ADD CONSTRAINT lecturas_amperaje_chk
    CHECK (amperaje IS NULL OR amperaje BETWEEN 0 AND 50) NOT VALID;

COMMENT ON COLUMN lecturas.valor_corriente IS 'Corriente medida en miliamperios (mA); rango operativo 0–50.';
COMMENT ON COLUMN lecturas.amperaje IS 'Corriente medida en miliamperios (mA); rango operativo 0–50.';

COMMIT;
