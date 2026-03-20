-- Align training_upsert_workout_set_progress behavior
-- Do not mark workout_exercises.completed_at on every completed set;
-- exercise-level completion stays managed by record_exercise_timing.

create or replace function public.training_upsert_workout_set_progress(
  p_set_id bigint,
  p_weight integer default null,
  p_reps integer default null,
  p_rir integer default null,
  p_started_at timestamptz default null,
  p_completed_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workout_exercise_id bigint;
  v_owner_user_id uuid;
  v_payload jsonb;
begin
  if p_set_id is null then
    raise exception 'p_set_id is required';
  end if;

  if p_weight is not null and p_weight < 0 then
    raise exception 'weight must be >= 0';
  end if;

  if p_reps is not null and p_reps < 0 then
    raise exception 'reps must be >= 0';
  end if;

  if p_rir is not null and (p_rir < 0 or p_rir > 10) then
    raise exception 'rir must be between 0 and 10';
  end if;

  select
    es.workout_exercise_id,
    w.user_id
  into v_workout_exercise_id, v_owner_user_id
  from public.exercise_sets es
  join public.workout_exercises we on we.id = es.workout_exercise_id
  join public.workouts w on w.id = we.workout_id
  where es.id = p_set_id;

  if v_workout_exercise_id is null then
    raise exception 'set_id % not found', p_set_id;
  end if;

  if not public.training_can_manage_user(v_owner_user_id) then
    raise exception 'not allowed to write set_id %', p_set_id;
  end if;

  update public.exercise_sets es
  set
    weight = coalesce(p_weight, es.weight),
    reps = coalesce(p_reps, es.reps),
    rir = coalesce(p_rir, es.rir),
    started_at = coalesce(es.started_at, p_started_at),
    completed_at = case
      when p_completed_at is null then es.completed_at
      else p_completed_at
    end
  where es.id = p_set_id;

  if p_started_at is not null then
    update public.workout_exercises we
    set started_at = coalesce(we.started_at, p_started_at)
    where we.id = v_workout_exercise_id;
  end if;

  select jsonb_build_object(
    'id', es.id,
    'workout_exercise_id', es.workout_exercise_id,
    'set_no', es.set_no,
    'weight', es.weight,
    'reps', es.reps,
    'rir', es.rir,
    'started_at', es.started_at,
    'completed_at', es.completed_at
  )
  into v_payload
  from public.exercise_sets es
  where es.id = p_set_id;

  return v_payload;
end;
$$;
