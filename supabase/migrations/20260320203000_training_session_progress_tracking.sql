-- Training session detailed progress tracking
-- Adds secure RPCs to persist:
-- - Per-set metrics and timing in real time
-- - Exercise/session notes
-- - Hydration payload to restore an in-progress exercise session

create or replace function public.training_get_workout_exercise_tracking(
  p_workout_exercise_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_user_id uuid;
  v_payload jsonb;
begin
  if p_workout_exercise_id is null then
    raise exception 'p_workout_exercise_id is required';
  end if;

  select w.user_id
  into v_owner_user_id
  from public.workout_exercises we
  join public.workouts w on w.id = we.workout_id
  where we.id = p_workout_exercise_id;

  if v_owner_user_id is null then
    raise exception 'workout_exercise_id % not found', p_workout_exercise_id;
  end if;

  if not public.training_can_manage_user(v_owner_user_id) then
    raise exception 'not allowed to read workout_exercise_id %', p_workout_exercise_id;
  end if;

  with base as (
    select
      we.id as workout_exercise_id,
      we.feedback,
      we.training_block_exercise_id,
      tbe.notes as block_exercise_note
    from public.workout_exercises we
    left join public.training_block_exercises tbe on tbe.id = we.training_block_exercise_id
    where we.id = p_workout_exercise_id
  )
  select jsonb_build_object(
    'workout_exercise_id', b.workout_exercise_id,
    'feedback', b.feedback,
    'training_block_exercise_id', b.training_block_exercise_id,
    'block_exercise_note', b.block_exercise_note,
    'sets', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', es.id,
          'set_no', es.set_no,
          'reps', es.reps,
          'weight', es.weight,
          'rir', es.rir,
          'target_reps_min', es.target_reps_min,
          'target_reps_max', es.target_reps_max,
          'target_weight', es.target_weight,
          'is_warmup', es.is_warmup,
          'started_at', es.started_at,
          'completed_at', es.completed_at
        )
        order by es.set_no asc nulls last, es.id asc
      )
      from public.exercise_sets es
      where es.workout_exercise_id = b.workout_exercise_id
    ), '[]'::jsonb)
  )
  into v_payload
  from base b;

  return coalesce(
    v_payload,
    jsonb_build_object(
      'workout_exercise_id', p_workout_exercise_id,
      'feedback', null,
      'training_block_exercise_id', null,
      'block_exercise_note', null,
      'sets', '[]'::jsonb
    )
  );
end;
$$;

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

create or replace function public.training_upsert_workout_exercise_notes(
  p_workout_exercise_id bigint,
  p_feedback text default null,
  p_block_exercise_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_user_id uuid;
  v_block_exercise_id bigint;
  v_feedback text;
  v_block_note text;
begin
  if p_workout_exercise_id is null then
    raise exception 'p_workout_exercise_id is required';
  end if;

  select
    w.user_id,
    we.training_block_exercise_id
  into v_owner_user_id, v_block_exercise_id
  from public.workout_exercises we
  join public.workouts w on w.id = we.workout_id
  where we.id = p_workout_exercise_id;

  if v_owner_user_id is null then
    raise exception 'workout_exercise_id % not found', p_workout_exercise_id;
  end if;

  if not public.training_can_manage_user(v_owner_user_id) then
    raise exception 'not allowed to write workout_exercise_id %', p_workout_exercise_id;
  end if;

  if p_feedback is not null then
    update public.workout_exercises we
    set feedback = nullif(trim(p_feedback), '')
    where we.id = p_workout_exercise_id;
  end if;

  if p_block_exercise_note is not null and v_block_exercise_id is not null then
    update public.training_block_exercises tbe
    set notes = nullif(trim(p_block_exercise_note), '')
    where tbe.id = v_block_exercise_id;
  end if;

  select we.feedback
  into v_feedback
  from public.workout_exercises we
  where we.id = p_workout_exercise_id;

  if v_block_exercise_id is not null then
    select tbe.notes
    into v_block_note
    from public.training_block_exercises tbe
    where tbe.id = v_block_exercise_id;
  end if;

  return jsonb_build_object(
    'workout_exercise_id', p_workout_exercise_id,
    'feedback', v_feedback,
    'training_block_exercise_id', v_block_exercise_id,
    'block_exercise_note', v_block_note
  );
end;
$$;

grant execute on function public.training_get_workout_exercise_tracking(bigint) to anon, authenticated, service_role;
grant execute on function public.training_upsert_workout_set_progress(bigint, integer, integer, integer, timestamptz, timestamptz) to anon, authenticated, service_role;
grant execute on function public.training_upsert_workout_exercise_notes(bigint, text, text) to anon, authenticated, service_role;
