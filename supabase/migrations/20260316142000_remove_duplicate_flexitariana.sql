-- ============================================================
-- MIGRATION: Eliminar "Flexitariana" de diet_types
-- Es un duplicado de "Basada en Plantas (flexible)" (id=3).
-- Los usuarios que la tuvieran asignada se reasignan a
-- "Basada en Plantas (flexible)" antes del borrado.
-- Las reglas se eliminan por CASCADE.
-- ============================================================

DO $$
DECLARE
  v_flexitariana_id bigint;
  v_basada_plantas_id bigint := 3;
BEGIN
  SELECT id INTO v_flexitariana_id
  FROM public.diet_types WHERE name = 'Flexitariana';

  IF v_flexitariana_id IS NOT NULL THEN
    -- Reasignar usuarios que tengan Flexitariana a Basada en Plantas (flexible)
    UPDATE public.diet_preferences
    SET diet_type_id = v_basada_plantas_id
    WHERE diet_type_id = v_flexitariana_id;

    -- Eliminar (las reglas se borran por CASCADE)
    DELETE FROM public.diet_types WHERE id = v_flexitariana_id;
  END IF;
END;
$$;
