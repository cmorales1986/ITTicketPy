-- PR-INF-03, P1 bloque 2: plazos en horario hábil.
-- Solo agrega tablas y columnas; el único UPDATE completa la columna nueva
-- fechaPrimeraRespuesta de los tickets históricos a partir de su propio
-- historial (no inventa datos: si no hay evidencia, queda en NULL).

CREATE TABLE IF NOT EXISTS "configuracion" (
  "clave" varchar(100) PRIMARY KEY,
  "valor" text NOT NULL,
  "fechaActualizacion" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "feriados" (
  "fecha" date PRIMARY KEY,
  "nombre" varchar(255) NOT NULL
);

ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "fechaPrimeraRespuesta" timestamp;
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "motivoDesvio" text;

-- Horario laboral (7:30 a 17:30, lunes a viernes). Editable desde el panel.
INSERT INTO "configuracion" ("clave", "valor")
VALUES ('horario', '{"dias":[1,2,3,4,5],"desde":"07:30","hasta":"17:30"}')
ON CONFLICT ("clave") DO NOTHING;

-- Feriados de Paraguay 2026 (Ley 7544/2025 y decretos de traslado; fuentes
-- periodísticas, confirmar contra la Gaceta Oficial). Si el Ejecutivo decreta
-- otros, se agregan desde el panel.
INSERT INTO "feriados" ("fecha", "nombre") VALUES
  ('2026-01-01', 'Año Nuevo'),
  ('2026-03-02', 'Día de los Héroes de la Patria (trasladado del 1 de marzo)'),
  ('2026-04-02', 'Jueves Santo'),
  ('2026-04-03', 'Viernes Santo'),
  ('2026-05-01', 'Día del Trabajador'),
  ('2026-05-14', 'Independencia Nacional'),
  ('2026-05-15', 'Independencia Nacional'),
  ('2026-06-12', 'Paz del Chaco'),
  ('2026-06-22', 'Jura de la Constitución (trasladado del 20 de junio)'),
  ('2026-06-30', 'Feriado adicional decretado por el Poder Ejecutivo'),
  ('2026-08-15', 'Fundación de Asunción'),
  ('2026-09-28', 'Batalla de Boquerón (trasladado del 29 de setiembre)'),
  ('2026-12-08', 'Virgen de Caacupé'),
  ('2026-12-25', 'Navidad')
ON CONFLICT ("fecha") DO NOTHING;

-- Tickets históricos: la primera respuesta es la primera asignación o el
-- primer paso a En Proceso/En Progreso que figura en su historial.
UPDATE "tickets" t
SET "fechaPrimeraRespuesta" = h.primera
FROM (
  SELECT "ticketId", min("fechaCreacion") AS primera
  FROM "historial"
  WHERE "tipo" = 'ASIGNACION'
     OR ("tipo" = 'ESTADO' AND "valorNuevo" IN ('En Progreso', 'En Proceso'))
  GROUP BY "ticketId"
) h
WHERE t."id" = h."ticketId" AND t."fechaPrimeraRespuesta" IS NULL;
