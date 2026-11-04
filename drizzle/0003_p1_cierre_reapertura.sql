-- PR-INF-03, P1 bloque 3: cierre automático y reapertura.
-- Solo agrega columnas; el UPDATE completa fechaCierre de los tickets
-- históricos que ya estaban en estado final a partir de fechaResolucion
-- (en el sistema anterior esa fecha se pisaba al cerrar, así que es la mejor
-- evidencia disponible del cierre). No toca ningún otro dato.

ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "fechaCierre" timestamp;
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "reaperturas" integer NOT NULL DEFAULT 0;
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "cerradoSinRespuesta" boolean NOT NULL DEFAULT false;
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "ticketAnteriorId" uuid REFERENCES "tickets" ("id");

UPDATE "tickets"
SET "fechaCierre" = "fechaResolucion"
WHERE "estado" IN (4, 5) AND "fechaCierre" IS NULL AND "fechaResolucion" IS NOT NULL;

-- Cierre sin respuesta a los 3 días hábiles; reapertura dentro de 5 días
-- hábiles. Editable desde el panel.
INSERT INTO "configuracion" ("clave", "valor")
VALUES ('cierre', '{"diasCierre":3,"diasReapertura":5}')
ON CONFLICT ("clave") DO NOTHING;
