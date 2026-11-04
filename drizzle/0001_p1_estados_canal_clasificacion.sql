-- PR-INF-03, P1 bloque 1: estados, canal y clasificación.
-- Solo agrega columnas (con default o NULL): no toca ni borra los tickets
-- existentes. Idempotente, se puede correr más de una vez.
-- Estados: el valor 1 pasa a llamarse "Nuevo" (solo cambia la etiqueta) y se
-- agrega el 5 = Cancelado; no hace falta migrar datos.

ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "canal" varchar(20);
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "tipo" integer NOT NULL DEFAULT 1;
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "sistemaModulo" varchar(255);
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "urgencia" integer;
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "solucion" text;
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "motivoCancelacion" text;
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "dependeProveedor" boolean NOT NULL DEFAULT false;
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "proveedorNombre" varchar(255);
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "proveedorFechaCompromiso" timestamp;
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "proveedorNotas" text;
