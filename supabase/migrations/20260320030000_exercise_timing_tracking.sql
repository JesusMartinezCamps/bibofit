-- ============================================================
-- Exercise & Workout Timing Tracking
-- ============================================================
-- Añade granularidad temporal a workouts, workout_exercises y
-- exercise_sets para poder medir:
--   · Duración total del entreno
--   · Duración del calentamiento
--   · Duración del trabajo real
--   · Tiempo de inicio y fin de cada serie
--   · Descanso entre series (lag entre completed_at de serie N y started_at de serie N+1)
-- ============================================================

-- ── 1. Columnas de timing en workout ──────────────────────────────────────────
ALTER TABLE workouts
  ADD COLUMN IF NOT EXISTS started_at        timestamptz,   -- inicio del calentamiento / sesión
  ADD COLUMN IF NOT EXISTS warmup_started_at timestamptz,   -- cuando se abre el calentamiento
  ADD COLUMN IF NOT EXISTS warmup_ended_at   timestamptz,   -- primera serie de trabajo activa
  ADD COLUMN IF NOT EXISTS ended_at          timestamptz;   -- última serie completada

-- ── 2. Columnas de timing en workout_exercises (por ejercicio) ────────────────
ALTER TABLE workout_exercises
  ADD COLUMN IF NOT EXISTS started_at   timestamptz,   -- primera serie activa del ejercicio
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;   -- última serie completada del ejercicio

-- ── 3. Columnas de timing en exercise_sets (por serie) ───────────────────────
ALTER TABLE exercise_sets
  ADD COLUMN IF NOT EXISTS started_at   timestamptz,   -- cuando el usuario activó la fila
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;   -- cuando pulsó "Serie completada"

-- Índice para consultas de analítica por usuario + fecha
CREATE INDEX IF NOT EXISTS workouts_timing_idx
  ON workouts (user_id, performed_on, started_at, ended_at)
  WHERE started_at IS NOT NULL;

-- ── 4. Vista de estadísticas por entreno ──────────────────────────────────────
CREATE OR REPLACE VIEW v_workout_timing_stats AS
WITH set_timing AS (
  SELECT
    we.workout_id,
    we.exercise_id,
    es.id              AS set_id,
    es.set_no,
    es.started_at,
    es.completed_at,
    EXTRACT(EPOCH FROM (es.completed_at - es.started_at))::integer AS set_work_sec,
    LAG(es.completed_at) OVER (
      PARTITION BY we.workout_id
      ORDER BY we.sequence, es.set_no
    ) AS prev_completed_at
  FROM exercise_sets es
  JOIN workout_exercises we ON we.id = es.workout_exercise_id
  WHERE es.started_at IS NOT NULL
    AND es.completed_at IS NOT NULL
)
SELECT
  w.id                                                                     AS workout_id,
  w.user_id,
  w.performed_on,
  w.started_at,
  w.ended_at,
  w.warmup_started_at,
  w.warmup_ended_at,
  -- Duraciones globales
  EXTRACT(EPOCH FROM (w.ended_at - w.started_at))::integer                 AS total_duration_sec,
  EXTRACT(EPOCH FROM (w.warmup_ended_at - w.warmup_started_at))::integer   AS warmup_duration_sec,
  EXTRACT(EPOCH FROM (w.ended_at - COALESCE(w.warmup_ended_at, w.started_at)))::integer
                                                                            AS work_duration_sec,
  -- Agregados de series
  COUNT(st.set_id)::integer                                                AS sets_completed,
  COUNT(DISTINCT st.exercise_id)::integer                                  AS exercises_count,
  ROUND(AVG(st.set_work_sec))::integer                                     AS avg_set_work_sec,
  ROUND(AVG(
    EXTRACT(EPOCH FROM (st.started_at - st.prev_completed_at))
  ) FILTER (WHERE st.prev_completed_at IS NOT NULL))::integer              AS avg_rest_sec,
  MAX(
    EXTRACT(EPOCH FROM (st.started_at - st.prev_completed_at))
  ) FILTER (WHERE st.prev_completed_at IS NOT NULL)::integer               AS max_rest_sec
FROM workouts w
LEFT JOIN set_timing st ON st.workout_id = w.id
WHERE w.started_at IS NOT NULL
GROUP BY
  w.id, w.user_id, w.performed_on,
  w.started_at, w.ended_at,
  w.warmup_started_at, w.warmup_ended_at;

-- ── 5. RPCs ───────────────────────────────────────────────────────────────────

-- 5a. Inicia el timing de un workout (primera llamada al montar la página)
CREATE OR REPLACE FUNCTION start_workout_timing(
  p_workout_id bigint,
  p_started_at timestamptz DEFAULT now()
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE workouts
  SET    started_at = p_started_at
  WHERE  id         = p_workout_id
    AND  user_id    = auth.uid()
    AND  started_at IS NULL;  -- idempotente: no sobreescribe si ya estaba
END;
$$;

-- 5b. Marca inicio y fin del calentamiento
CREATE OR REPLACE FUNCTION mark_warmup_timing(
  p_workout_id        bigint,
  p_warmup_started_at timestamptz,
  p_warmup_ended_at   timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE workouts
  SET    warmup_started_at = p_warmup_started_at,
         warmup_ended_at   = p_warmup_ended_at
  WHERE  id      = p_workout_id
    AND  user_id = auth.uid();
END;
$$;

-- 5c. Registra start + completed de una serie concreta
CREATE OR REPLACE FUNCTION record_set_completion(
  p_set_id       bigint,
  p_started_at   timestamptz,
  p_completed_at timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE exercise_sets es
  SET    started_at   = p_started_at,
         completed_at = p_completed_at
  FROM   workout_exercises we
  JOIN   workouts w ON w.id = we.workout_id
  WHERE  es.id                  = p_set_id
    AND  es.workout_exercise_id = we.id
    AND  w.user_id              = auth.uid();
END;
$$;

-- 5d. Marca el ejercicio como completado (timestamps de ejercicio)
CREATE OR REPLACE FUNCTION record_exercise_timing(
  p_workout_exercise_id bigint,
  p_started_at          timestamptz,
  p_completed_at        timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE workout_exercises we
  SET    started_at   = p_started_at,
         completed_at = p_completed_at
  FROM   workouts w
  WHERE  we.id         = p_workout_exercise_id
    AND  we.workout_id = w.id
    AND  w.user_id     = auth.uid();
END;
$$;

-- 5e. Cierra el timing del workout (fin de sesión)
CREATE OR REPLACE FUNCTION finish_workout_timing(
  p_workout_id bigint,
  p_ended_at   timestamptz DEFAULT now()
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE workouts
  SET    ended_at = p_ended_at
  WHERE  id       = p_workout_id
    AND  user_id  = auth.uid();
END;
$$;

-- 5f. Resumen completo del timing de un workout (para la pantalla final)
CREATE OR REPLACE FUNCTION get_workout_timing_summary(p_workout_id bigint)
RETURNS TABLE (
  total_duration_sec  integer,
  warmup_duration_sec integer,
  work_duration_sec   integer,
  sets_completed      integer,
  exercises_count     integer,
  avg_set_work_sec    integer,
  avg_rest_sec        integer,
  max_rest_sec        integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.total_duration_sec,
    s.warmup_duration_sec,
    s.work_duration_sec,
    s.sets_completed,
    s.exercises_count,
    s.avg_set_work_sec,
    s.avg_rest_sec,
    s.max_rest_sec
  FROM v_workout_timing_stats s
  WHERE s.workout_id = p_workout_id
    AND s.user_id    = auth.uid();
END;
$$;

-- 5g. Histórico de duración de entrenos (para gráficas de progresión)
CREATE OR REPLACE FUNCTION get_workout_duration_history(
  p_user_id uuid,
  p_limit   integer DEFAULT 30
)
RETURNS TABLE (
  workout_id          bigint,
  performed_on        date,
  total_duration_sec  integer,
  warmup_duration_sec integer,
  work_duration_sec   integer,
  sets_completed      integer,
  avg_rest_sec        integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Solo el propio usuario o un coach pueden acceder
  IF auth.uid() != p_user_id AND NOT EXISTS (
    SELECT 1 FROM coach_clients
    WHERE coach_id = auth.uid() AND client_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Acceso denegado';
  END IF;

  RETURN QUERY
  SELECT
    s.workout_id,
    s.performed_on,
    s.total_duration_sec,
    s.warmup_duration_sec,
    s.work_duration_sec,
    s.sets_completed,
    s.avg_rest_sec
  FROM v_workout_timing_stats s
  WHERE s.user_id        = p_user_id
    AND s.ended_at       IS NOT NULL
  ORDER BY s.performed_on DESC
  LIMIT p_limit;
END;
$$;
