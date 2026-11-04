-- Técnico predeterminado por empresa: los tickets nuevos de esa empresa se
-- asignan solos a ese técnico. Solo agrega una columna (NULL): no modifica
-- ningún ticket existente.

ALTER TABLE "empresas" ADD COLUMN IF NOT EXISTS "tecnicoPredeterminadoId" uuid REFERENCES "usuarios"("id");

-- Datos iniciales: Paraguay Pork -> Christian Morales; Nutrivic -> Milciades Ranoni.
UPDATE "empresas" SET "tecnicoPredeterminadoId" = (SELECT "id" FROM "usuarios" WHERE "nombre" = 'Christian Morales' AND "rol" IN (1, 3) LIMIT 1)
WHERE "nombre" = 'Paraguay Pork' AND "tecnicoPredeterminadoId" IS NULL;

UPDATE "empresas" SET "tecnicoPredeterminadoId" = (SELECT "id" FROM "usuarios" WHERE "nombre" = 'Milciades Ranoni' AND "rol" IN (1, 3) LIMIT 1)
WHERE "nombre" = 'Nutrivic' AND "tecnicoPredeterminadoId" IS NULL;
