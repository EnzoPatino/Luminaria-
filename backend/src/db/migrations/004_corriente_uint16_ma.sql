BEGIN;

ALTER TABLE lecturas
  DROP CONSTRAINT IF EXISTS lecturas_corriente_chk,
  DROP CONSTRAINT IF EXISTS lecturas_amperaje_chk;

ALTER TABLE lecturas
  ADD CONSTRAINT lecturas_corriente_chk
    CHECK (valor_corriente IS NULL OR valor_corriente BETWEEN 0 AND 65535) NOT VALID,
  ADD CONSTRAINT lecturas_amperaje_chk
    CHECK (amperaje IS NULL OR amperaje BETWEEN 0 AND 65535) NOT VALID;

COMMENT ON COLUMN lecturas.valor_corriente IS 'Corriente medida en miliamperios (mA), codificada como uint16 big-endian.';
COMMENT ON COLUMN lecturas.amperaje IS 'Corriente medida en miliamperios (mA), codificada como uint16 big-endian.';

COMMIT;
