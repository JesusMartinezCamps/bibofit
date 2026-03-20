-- Training session contract hardening
-- Goal:
-- 1) Provide a single, stable session contract RPC for training UI.
-- 2) Keep legacy wrappers compatible while routing through V2 secure RPCs.
-- 3) Expose a timeline events RPC for weekly dots/hitos.

-- -----------------------------------------------------------------------------
-- 0) Timing columns/indexes (idempotent safety net)
-- -----------------------------------------------------------------------------
alter table public.workouts
  add column if not exists started_at timestamptz,
  add column if not exists warmup_started_at timestamptz,
  add column if not exists warmup_ended_at timestamptz,
  add column if not exists ended_at timestamptz;

alter table public.workout_exercises
  add column if not exists started_at timestamptz,
  add column if not exists completed_at timestamptz;

alter table public.exercise_sets
  add column if not exists started_at timestamptz,
  add column if not exists completed_at timestamptz;

create index if not exists workouts_timing_idx
  on public.workouts (user_id, performed_on, started_at, ended_at)
  where started_at is not null;

-- -----------------------------------------------------------------------------
-- 1) Unified contract: get-or-create workout session payload
-- -----------------------------------------------------------------------------
create or replace function public.training_get_or_create_workout_session(
  p_training_weekly_day_id bigint,
  p_on_date date default current_date,
  p_user_id uuid default auth.uid(),
  p_force_new boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_user_id uuid := coalesce(p_user_id, auth.uid());
  v_workout_id bigint;
  v_payload jsonb;
begin
  if p_training_weekly_day_id is null then
    raise exception 'p_training_weekly_day_id is required';
  end if;

  if v_target_user_id is null then
    raise exception 'p_user_id is required';
  end if;

  if not public.training_can_manage_user(v_target_user_id) then
    raise exception 'not allowed to create/read workout session for user %', v_target_user_id;
  end if;

  v_workout_id := public.training_create_workout_from_day(
    p_training_weekly_day_id,
    coalesce(p_on_date, current_date),
    v_target_user_id,
    coalesce(p_force_new, false)
  );

  v_payload := public.training_get_workout_session_payload(v_workout_id, v_target_user_id);

  return coalesce(
    v_payload,
    jsonb_build_object(
      'workout', null,
      'exercises', '[]'::jsonb
    )
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 2) Timeline events for weekly/day hitos
-- -----------------------------------------------------------------------------
create or replace function public.training_get_workout_timeline_events(
  p_user_id uuid default auth.uid(),
  p_start_date date default current_date - 6,
  p_end_date date default current_date
)
returns table (
  event_date date,
  workout_id bigint,
  weekly_day_id bigint,
  weekly_day_index integer,
  weekly_day_name text,
  completed_sets integer,
  total_sets integer,
  completed_key_exercises integer,
  total_key_exercises integer,
  is_completed boolean
)
language sql
security definer
stable
set search_path = public
as $$
  with bounds as (
    select
      least(coalesce(p_start_date, current_date), coalesce(p_end_date, current_date)) as start_date,
      greatest(coalesce(p_start_date, current_date), coalesce(p_end_date, current_date)) as end_date
  ), workouts_in_range as (
    select
      w.id as workout_id,
      w.performed_on as event_date,
      w.training_weekly_day_id as weekly_day_id,
      twd.day_index as weekly_day_index,
      twd.name as weekly_day_name
    from public.workouts w
    left join public.training_weekly_days twd on twd.id = w.training_weekly_day_id
    join bounds b
      on w.performed_on between b.start_date and b.end_date
    where w.user_id = p_user_id
  ), sets_by_workout as (
    select
      we.workout_id,
      count(es.id)::integer as total_sets,
      count(es.id) filter (
        where es.reps is not null
           or es.weight is not null
           or es.rir is not null
      )::integer as completed_sets
    from public.workout_exercises we
    left join public.exercise_sets es on es.workout_exercise_id = we.id
    group by we.workout_id
  ), key_by_workout as (
    select
      we.workout_id,
      count(*) filter (where coalesce(tbe.is_key_exercise, false))::integer as total_key_exercises,
      count(*) filter (
        where coalesce(tbe.is_key_exercise, false)
          and exists (
            select 1
            from public.exercise_sets es2
            where es2.workout_exercise_id = we.id
              and (
                es2.reps is not null
                or es2.weight is not null
                or es2.rir is not null
              )
          )
      )::integer as completed_key_exercises
    from public.workout_exercises we
    left join public.training_block_exercises tbe on tbe.id = we.training_block_exercise_id
    group by we.workout_id
  )
  select
    wr.event_date,
    wr.workout_id,
    wr.weekly_day_id,
    wr.weekly_day_index,
    wr.weekly_day_name,
    coalesce(sbw.completed_sets, 0) as completed_sets,
    coalesce(sbw.total_sets, 0) as total_sets,
    coalesce(kbw.completed_key_exercises, 0) as completed_key_exercises,
    coalesce(kbw.total_key_exercises, 0) as total_key_exercises,
    (
      coalesce(sbw.total_sets, 0) > 0
      and coalesce(sbw.completed_sets, 0) >= coalesce(sbw.total_sets, 0)
    ) as is_completed
  from workouts_in_range wr
  left join sets_by_workout sbw on sbw.workout_id = wr.workout_id
  left join key_by_workout kbw on kbw.workout_id = wr.workout_id
  where public.training_can_manage_user(p_user_id)
  order by wr.event_date asc, wr.workout_id asc;
$$;

-- -----------------------------------------------------------------------------
-- 3) Legacy wrappers (compatibility) routed to V2 secure stack
-- -----------------------------------------------------------------------------
create or replace function public.create_or_get_workout_session(
  p_weekly_day_id bigint,
  p_on_date date default current_date
)
returns table (
  workout_id bigint,
  exercise_map jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payload jsonb;
  v_workout_id bigint;
  v_exercise_map jsonb;
begin
  v_payload := public.training_get_or_create_workout_session(
    p_training_weekly_day_id => p_weekly_day_id,
    p_on_date => p_on_date,
    p_user_id => auth.uid(),
    p_force_new => false
  );

  v_workout_id := nullif(v_payload #>> '{workout,id}', '')::bigint;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'workout_exercise_id', nullif(e->>'id', '')::bigint,
        'block_exercise_id', nullif(e->>'training_block_exercise_id', '')::bigint,
        'exercise_id', nullif(e->>'exercise_id', '')::bigint
      )
      order by nullif(e->>'sequence', '')::integer nulls last,
               nullif(e->>'id', '')::bigint nulls last
    ),
    '[]'::jsonb
  )
  into v_exercise_map
  from jsonb_array_elements(coalesce(v_payload->'exercises', '[]'::jsonb)) as e;

  return query
  select v_workout_id, coalesce(v_exercise_map, '[]'::jsonb);
end;
$$;

create or replace function public.get_previous_exercise_sets(
  p_exercise_id bigint,
  p_exclude_workout_id bigint default null
)
returns table (
  set_no integer,
  weight integer,
  reps integer,
  rir integer,
  performed_on date
)
language sql
security definer
stable
set search_path = public
as $$
  with last_workout as (
    select w.id, w.performed_on
    from public.workouts w
    join public.workout_exercises we on we.workout_id = w.id
    where we.exercise_id = p_exercise_id
      and w.user_id = auth.uid()
      and (p_exclude_workout_id is null or w.id <> p_exclude_workout_id)
      and exists (
        select 1
        from public.exercise_sets es
        where es.workout_exercise_id = we.id
          and (
            es.reps is not null
            or es.weight is not null
            or es.rir is not null
          )
      )
    order by w.performed_on desc, w.id desc
    limit 1
  )
  select
    es.set_no,
    es.weight,
    es.reps,
    es.rir,
    lw.performed_on
  from last_workout lw
  join public.workout_exercises we
    on we.workout_id = lw.id
   and we.exercise_id = p_exercise_id
  join public.exercise_sets es
    on es.workout_exercise_id = we.id
  where es.set_no is not null
    and (
      es.reps is not null
      or es.weight is not null
      or es.rir is not null
    )
  order by es.set_no asc;
$$;

-- -----------------------------------------------------------------------------
-- 4) Grants
-- -----------------------------------------------------------------------------
grant execute on function public.training_get_or_create_workout_session(bigint,date,uuid,boolean) to anon, authenticated, service_role;
grant execute on function public.training_get_workout_timeline_events(uuid,date,date) to anon, authenticated, service_role;
grant execute on function public.create_or_get_workout_session(bigint,date) to anon, authenticated, service_role;
grant execute on function public.get_previous_exercise_sets(bigint,bigint) to anon, authenticated, service_role;
