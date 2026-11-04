-- PR-INF-03, P2: desarrollo y mejora, análisis de causa y reincidencia.
-- Solo agrega columnas (con default o NULL) y una tabla nueva de solo alta.
-- No modifica ningún ticket existente.

ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "evalAlcance" text;
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "evalEsfuerzo" varchar(100);
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "evalConCosto" boolean NOT NULL DEFAULT false;
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "evalCosto" varchar(100);
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "evalImpacto" text;
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "plazoPropuesto" date;
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "pruebasResultado" varchar(20);
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "pruebasFecha" date;
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "pruebasNota" text;
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "produccionFecha" date;
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "proveedorEntregablesVerificados" boolean NOT NULL DEFAULT false;
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "analisisCausa" text;
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "reincidente" boolean NOT NULL DEFAULT false;

-- Aprobaciones: AREA (gerente del área), TI (Gerente de TI), GG (Gerencia
-- General, si hay costo). Cada una con quién, cuándo y comentario o evidencia.
CREATE TABLE IF NOT EXISTS "aprobaciones" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "ticketId" uuid NOT NULL REFERENCES "tickets" ("id"),
  "tipo" varchar(10) NOT NULL,
  "aprobadoPor" varchar(255) NOT NULL,
  "fechaAprobacion" date NOT NULL,
  "comentario" text NOT NULL,
  "registradoPorId" uuid NOT NULL REFERENCES "usuarios" ("id"),
  "fechaRegistro" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "aprobaciones_ticket_idx" ON "aprobaciones" ("ticketId");

-- Solo de alta, como el historial: la constancia no se modifica ni se borra.
CREATE OR REPLACE FUNCTION bloquear_modificacion_aprobacion() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Las aprobaciones son una constancia (PR-INF-03): no se permite % de registros; registrá una aprobación nueva para corregir', lower(TG_OP);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS aprobaciones_inmutables ON "aprobaciones";
CREATE TRIGGER aprobaciones_inmutables
  BEFORE UPDATE OR DELETE ON "aprobaciones"
  FOR EACH ROW EXECUTE FUNCTION bloquear_modificacion_aprobacion();

DROP TRIGGER IF EXISTS aprobaciones_sin_vaciado ON "aprobaciones";
CREATE TRIGGER aprobaciones_sin_vaciado
  BEFORE TRUNCATE ON "aprobaciones"
  FOR EACH STATEMENT EXECUTE FUNCTION bloquear_modificacion_aprobacion();
