-- PR-INF-03, P1 bloque 5: lugar de origen, fecha de recepción, conformidad
-- y horario de la granja. Solo agrega columnas (NULL) y una fila de
-- configuración: no modifica ningún ticket existente.

ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "lugarOrigen" varchar(10);
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "fechaRecepcion" timestamp;
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "conformidadFecha" timestamp;
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "conformidadCanal" varchar(20);
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "conformidadNota" text;

-- Granja: lunes a domingo, de 7:00 a 18:00. La oficina (7:30 a 17:30) sigue
-- en la clave 'horario'. Editable desde el panel.
INSERT INTO "configuracion" ("clave", "valor")
VALUES ('horarioGranja', '{"dias":[0,1,2,3,4,5,6],"desde":"07:00","hasta":"18:00"}')
ON CONFLICT ("clave") DO NOTHING;
