-- ============================================================
-- Workout Session Creation & Previous Performance RPCs
-- ============================================================
-- RPC 1: create_or_get_workout_session
--   Crea (o recupera) el workout del día + sus workout_exercises.
--   Idempotente: si ya existe un workout para ese día/usuario, lo devuelve.
--
-- RPC 2: get_previous_exercise_sets
--   Devuelve los datos de la ÚLTIMA sesión para un ejercicio,
--   agrupados por número de serie (set_no).
--   Crucial para mostrar "S2 anterior: 175 kg × 4 reps" en la UI.
-- ============================================================

-- ── RPC 1: create_or_get_workout_session ──────────────────────────────────────

CREATE OR REPLACE FUNCTION create_or_get_workout_session(
  p_weekly_day_id bigint,
  p_on_date       date DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  workout_id   bigint,
  exercise_map jsonb   -- [{workout_exercise_id, block_exercise_id, exercise_id}]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id      uuid   := auth.uid();
  v_workout_id   bigint;
  v_routine_id   bigint;
  v_we_id        bigint;
  v_exercise_map jsonb  := '[]'::jsonb;
  v_rec          record;
BEGIN
  -- Obtener el routine_id del día
  SELECT twd.weekly_routine_id
    INTO v_routine_id
    FROM training_weekly_days twd
   WHERE twd.id = p_weekly_day_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Día de entrenamiento % no encontrado', p_weekly_day_id;
  END IF;

  -- ¿Ya existe un workout para este día/usuario/fecha?
  SELECT w.id
    INTO v_workout_id
    FROM workouts w
   WHERE w.user_id                  = v_user_id
     AND w.training_weekly_day_id   = p_weekly_day_id
     AND w.performed_on             = p_on_date
   LIMIT 1;

  IF v_workout_id IS NULL THEN
    -- Crear workout
    INSERT INTO workouts (
      user_id,
      training_weekly_day_id,
      training_weekly_routine_id,
      performed_on
    )
    VALUES (
      v_user_id,
      p_weekly_day_id,
      v_routine_id,
      p_on_date
    )
    RETURNING id INTO v_workout_id;

    -- Crear un workout_exercise por cada ejercicio del día
    FOR v_rec IN
      SELECT
        twdb.id            AS block_id,
        twdb.block_order,
        tbe.id             AS block_exercise_id,
        tbe.exercise_id,
        tbe.exercise_order
      FROM training_weekly_day_blocks twdb
      JOIN training_block_exercises tbe ON tbe.weekly_day_block_id = twdb.id
     WHERE twdb.weekly_day_id = p_weekly_day_id
     ORDER BY twdb.block_order, tbe.exercise_order
    LOOP
      INSERT INTO workout_exercises (
        workout_id,
        exercise_id,
        sequence,
        training_weekly_day_block_id,
        training_block_exercise_id
      )
      VALUES (
        v_workout_id,
        v_rec.exercise_id,
        v_rec.block_order * 100 + v_rec.exercise_order,
        v_rec.block_id,
        v_rec.block_exercise_id
      )
      RETURNING id INTO v_we_id;

      v_exercise_map := v_exercise_map || jsonb_build_array(
        jsonb_build_object(
          'workout_exercise_id', v_we_id,
          'block_exercise_id',   v_rec.block_exercise_id,
          'exercise_id',         v_rec.exercise_id
        )
      );
    END LOOP;

  ELSE
    -- Cargar el mapa existente (sin recrear)
    SELECT jsonb_agg(
      jsonb_build_object(
        'workout_exercise_id',  we.id,
        'block_exercise_id',    we.training_block_exercise_id,
        'exercise_id',          we.exercise_id
      )
      ORDER BY we.sequence
    )
    INTO v_exercise_map
    FROM workout_exercises we
   WHERE we.workout_id = v_workout_id;
  END IF;

  RETURN QUERY SELECT v_workout_id, COALESCE(v_exercise_map, '[]'::jsonb);
END;
$$;

-- ── RPC 2: get_previous_exercise_sets ─────────────────────────────────────────
-- Devuelve los sets de la ÚLTIMA sesión con ese ejercicio,
-- ordenados por set_no. El front los usa para mostrar el rendimiento
-- anterior POR NÚMERO DE SERIE (no el global).

CREATE OR REPLACE FUNCTION get_previous_exercise_sets(
  p_exercise_id        bigint,
  p_exclude_workout_id bigint DEFAULT NULL   -- excluir el workout actual
)
RETURNS TABLE (
  set_no       integer,
  weight       integer,
  reps         integer,
  rir          integer,
  performed_on date
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prev_workout_id bigint;
BEGIN
  -- Localizar el workout más reciente (del usuario) con ese ejercicio
  SELECT w.id
    INTO v_prev_workout_id
    FROM workouts w
    JOIN workout_exercises we ON we.workout_id = w.id
   WHERE we.exercise_id = p_exercise_id
     AND w.user_id      = auth.uid()
     AND (p_exclude_workout_id IS NULL OR w.id <> p_exclude_workout_id)
     AND EXISTS (
       SELECT 1 FROM exercise_sets es
        WHERE es.workout_exercise_id = we.id AND es.reps IS NOT NULL
     )
   ORDER BY w.performed_on DESC
   LIMIT 1;

  IF v_prev_workout_id IS NULL THEN
    RETURN; -- Sin historial: tabla vacía
  END IF;

  RETURN QUERY
  SELECT
    es.set_no,
    es.weight,
    es.reps,
    es.rir,
    w.performed_on
  FROM exercise_sets es
  JOIN workout_exercises we ON we.id = es.workout_exercise_id
  JOIN workouts w            ON w.id  = we.workout_id
 WHERE we.exercise_id  = p_exercise_id
   AND w.id            = v_prev_workout_id
   AND es.reps         IS NOT NULL
 ORDER BY es.set_no;
END;
$$;
