-- PR-INF-03, P1 bloque 4: historial inmutable y conservación de 3 años.
-- Las reglas viven en la base (triggers), no solo en la app: valen aunque
-- alguien escriba SQL directo o un bug de la app intente borrar.
-- No toca ningún dato existente.

-- 1) El historial de cambios no se puede modificar, borrar ni vaciar.
CREATE OR REPLACE FUNCTION bloquear_modificacion_historial() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'El historial de tickets es inmutable (PR-INF-03): no se permite % de registros', lower(TG_OP);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS historial_inmutable ON "historial";
CREATE TRIGGER historial_inmutable
  BEFORE UPDATE OR DELETE ON "historial"
  FOR EACH ROW EXECUTE FUNCTION bloquear_modificacion_historial();

DROP TRIGGER IF EXISTS historial_sin_vaciado ON "historial";
CREATE TRIGGER historial_sin_vaciado
  BEFORE TRUNCATE ON "historial"
  FOR EACH STATEMENT EXECUTE FUNCTION bloquear_modificacion_historial();

-- 2) Un ticket no se borra. Única excepción: uno Cerrado o Cancelado cuyo
-- cierre tiene más de 3 años (vencida la conservación).
CREATE OR REPLACE FUNCTION proteger_borrado_ticket() RETURNS trigger AS $$
BEGIN
  IF OLD."estado" IN (4, 5)
     AND OLD."fechaCierre" IS NOT NULL
     AND OLD."fechaCierre" < now() - interval '3 years' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'No se puede borrar el ticket %: los tickets se conservan 3 años desde el cierre (PR-INF-03)', OLD."numero";
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tickets_conservacion ON "tickets";
CREATE TRIGGER tickets_conservacion
  BEFORE DELETE ON "tickets"
  FOR EACH ROW EXECUTE FUNCTION proteger_borrado_ticket();

-- 3) La evidencia de un ticket Cerrado o Cancelado (adjuntos, notas internas,
-- chat con el usuario) tampoco se borra durante la conservación.
CREATE OR REPLACE FUNCTION proteger_borrado_evidencia() RETURNS trigger AS $$
DECLARE
  t record;
BEGIN
  SELECT "estado", "fechaCierre" INTO t FROM "tickets" WHERE "id" = OLD."ticketId";
  IF FOUND AND t."estado" IN (4, 5)
     AND (t."fechaCierre" IS NULL OR t."fechaCierre" >= now() - interval '3 years') THEN
    RAISE EXCEPTION 'No se puede borrar evidencia de un ticket cerrado o cancelado: se conserva 3 años desde el cierre (PR-INF-03)';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS adjuntos_conservacion ON "adjuntos";
CREATE TRIGGER adjuntos_conservacion
  BEFORE DELETE ON "adjuntos"
  FOR EACH ROW EXECUTE FUNCTION proteger_borrado_evidencia();

DROP TRIGGER IF EXISTS comentarios_conservacion ON "comentarios";
CREATE TRIGGER comentarios_conservacion
  BEFORE DELETE ON "comentarios"
  FOR EACH ROW EXECUTE FUNCTION proteger_borrado_evidencia();

DROP TRIGGER IF EXISTS mensajes_chat_conservacion ON "mensajesChat";
CREATE TRIGGER mensajes_chat_conservacion
  BEFORE DELETE ON "mensajesChat"
  FOR EACH ROW EXECUTE FUNCTION proteger_borrado_evidencia();
