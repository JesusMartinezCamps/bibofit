-- Add configurable rest time per exercise prescription
-- Stored in seconds, default 120s, allowed range 15s..300s, in 5s increments.

alter table public.training_block_exercises
  add column if not exists rest_seconds integer;

update public.training_block_exercises
set rest_seconds = 120
where rest_seconds is null;

alter table public.training_block_exercises
  alter column rest_seconds set default 120,
  alter column rest_seconds set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'training_block_exercises_rest_seconds_check'
  ) then
    alter table public.training_block_exercises
      add constraint training_block_exercises_rest_seconds_check
      check (rest_seconds between 15 and 300 and rest_seconds % 5 = 0);
  end if;
end $$;

comment on column public.training_block_exercises.rest_seconds is
  'Target rest between effective sets (seconds). Allowed: 15..300, step 5. Default 120.';

-- Keep quickstart RPC aligned with new exercise field so wizard-configured rest persists.
create or replace function public.training_create_weekly_routine_quickstart_v2(
  p_weekly_routine_name text default null,
  p_cycle_days integer default null,
  p_days jsonb default '[]'::jsonb,
  p_objective_id bigint default null,
  p_start_date date default current_date,
  p_user_id uuid default auth.uid(),
  p_muscle_targets jsonb default '[]'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_user_id uuid := coalesce(p_user_id, auth.uid());
  v_start_date date := coalesce(p_start_date, current_date);
  v_days_count integer;
  v_end_date date;
  v_objective_id bigint;
  v_objective_name text;
  v_mesocycle_id bigint;
  v_weekly_routine_id bigint;
  v_day jsonb;
  v_day_idx integer := 0;
  v_day_name text;
  v_weekly_day_id bigint;
  v_block jsonb;
  v_block_idx integer;
  v_block_type text;
  v_block_name text;
  v_weekly_day_block_id bigint;
  v_routine_name text := coalesce(nullif(trim(coalesce(p_weekly_routine_name, '')), ''), 'Rutina semanal');
  v_muscle_target jsonb;
  v_muscle_id bigint;
  v_target_sets numeric;
begin
  if v_target_user_id is null then
    raise exception 'p_user_id is required';
  end if;

  if not public.training_can_manage_user(v_target_user_id) then
    raise exception 'not allowed to create training routine for user %', v_target_user_id;
  end if;

  if p_days is null or jsonb_typeof(p_days) <> 'array' or jsonb_array_length(p_days) = 0 then
    raise exception 'p_days must be a non-empty JSON array';
  end if;

  v_days_count := coalesce(p_cycle_days, jsonb_array_length(p_days));

  if v_days_count <> jsonb_array_length(p_days) then
    raise exception 'p_cycle_days (%) must match p_days length (%)', v_days_count, jsonb_array_length(p_days);
  end if;

  -- Allow 1-14 day cycles (frontend caps at 7)
  if v_days_count < 1 or v_days_count > 14 then
    raise exception 'p_cycle_days must be between 1 and 14';
  end if;

  if p_objective_id is null then
    select o.id, o.name
    into v_objective_id, v_objective_name
    from public.training_objectives o
    where o.is_active
    order by o.display_order asc, o.id asc
    limit 1;
  else
    select o.id, o.name
    into v_objective_id, v_objective_name
    from public.training_objectives o
    where o.id = p_objective_id
      and o.is_active;
  end if;

  if v_objective_id is null then
    raise exception 'no active training objective found';
  end if;

  v_end_date := v_start_date + (v_days_count - 1);

  insert into public.mesocycles (
    user_id,
    name,
    objective,
    objective_id,
    start_date,
    end_date,
    sessions_per_week
  )
  values (
    v_target_user_id,
    v_routine_name || ' - ' || to_char(v_start_date, 'YYYY-MM-DD'),
    v_objective_name,
    v_objective_id,
    v_start_date,
    v_end_date,
    v_days_count
  )
  returning id into v_mesocycle_id;

  insert into public.training_weekly_routines (
    mesocycle_id,
    name,
    sessions_per_week,
    is_default
  )
  values (
    v_mesocycle_id,
    v_routine_name,
    v_days_count,
    true
  )
  returning id into v_weekly_routine_id;

  for v_day in
    select value from jsonb_array_elements(p_days)
  loop
    v_day_idx := v_day_idx + 1;
    v_day_name := nullif(trim(coalesce(v_day->>'name', '')), '');

    insert into public.training_weekly_days (
      weekly_routine_id,
      day_index,
      name
    )
    values (
      v_weekly_routine_id,
      v_day_idx,
      coalesce(v_day_name, 'Dia ' || v_day_idx::text)
    )
    returning id into v_weekly_day_id;

    if v_day ? 'blocks'
      and jsonb_typeof(v_day->'blocks') = 'array'
      and jsonb_array_length(v_day->'blocks') > 0 then
      v_block_idx := 0;

      for v_block in
        select value from jsonb_array_elements(v_day->'blocks')
      loop
        v_block_idx := v_block_idx + 1;
        v_block_type := lower(trim(coalesce(v_block->>'type', '')));

        if v_block_type = ''
          or v_block_type not in (
            'torso','pierna','fullbody','push','pull','core','cardio','movilidad','custom'
          ) then
          v_block_type := 'custom';
        end if;

        v_block_name := nullif(trim(coalesce(v_block->>'name', v_block->>'label', '')), '');

        insert into public.training_weekly_day_blocks (
          weekly_day_id,
          block_order,
          block_type,
          name
        )
        values (
          v_weekly_day_id,
          v_block_idx,
          v_block_type,
          v_block_name
        )
        returning id into v_weekly_day_block_id;

        if v_block ? 'exercises'
          and jsonb_typeof(v_block->'exercises') = 'array'
          and jsonb_array_length(v_block->'exercises') > 0 then
          insert into public.training_block_exercises (
            weekly_day_block_id,
            exercise_id,
            exercise_order,
            preferred_equipment_id,
            target_sets,
            target_reps_min,
            target_reps_max,
            progression_increment_kg,
            backoff_percentage,
            is_key_exercise,
            notes,
            target_rir,
            rest_seconds,
            tempo
          )
          select
            v_weekly_day_block_id,
            nullif(trim(coalesce(x.value->>'exercise_id', '')), '')::bigint,
            x.ordinality::integer,
            nullif(trim(coalesce(x.value->>'preferred_equipment_id', '')), '')::bigint,
            coalesce(nullif(trim(coalesce(x.value->>'target_sets', '')), '')::integer, 3),
            coalesce(nullif(trim(coalesce(x.value->>'target_reps_min', '')), '')::integer, 8),
            coalesce(nullif(trim(coalesce(x.value->>'target_reps_max', '')), '')::integer, 12),
            coalesce(nullif(trim(coalesce(x.value->>'progression_increment_kg', '')), '')::integer, 5),
            coalesce(nullif(trim(coalesce(x.value->>'backoff_percentage', '')), '')::numeric, 0.800),
            coalesce(nullif(trim(coalesce(x.value->>'is_key_exercise', '')), '')::boolean, x.ordinality = 1),
            nullif(trim(coalesce(x.value->>'notes', '')), ''),
            nullif(trim(coalesce(x.value->>'target_rir', '')), '')::smallint,
            greatest(
              15,
              least(
                300,
                (round(
                  coalesce(nullif(trim(coalesce(x.value->>'rest_seconds', '')), '')::integer, 120)::numeric / 5
                ) * 5)::integer
              )
            ),
            nullif(trim(coalesce(x.value->>'tempo', '')), '')
          from jsonb_array_elements(v_block->'exercises') with ordinality as x(value, ordinality)
          where nullif(trim(coalesce(x.value->>'exercise_id', '')), '') is not null;
        end if;
      end loop;
    else
      insert into public.training_weekly_day_blocks (
        weekly_day_id,
        block_order,
        block_type,
        name
      )
      values (
        v_weekly_day_id,
        1,
        'custom',
        null
      );
    end if;
  end loop;

  insert into public.training_microcycles (
    mesocycle_id,
    sequence_index,
    name,
    objective_id,
    start_date,
    end_date,
    deload_week
  )
  values (
    v_mesocycle_id,
    1,
    'Microciclo 1',
    v_objective_id,
    v_start_date,
    v_end_date,
    false
  );

  -- Muscle volume targets
  if p_muscle_targets is not null
    and jsonb_typeof(p_muscle_targets) = 'array'
    and jsonb_array_length(p_muscle_targets) > 0 then

    insert into public.training_muscle_volume_targets (
      weekly_routine_id,
      muscle_id,
      target_sets_per_week
    )
    select
      v_weekly_routine_id,
      (mt.value->>'muscle_id')::bigint,
      (mt.value->>'target_sets')::numeric
    from jsonb_array_elements(p_muscle_targets) as mt(value)
    where (mt.value->>'muscle_id') is not null
      and (mt.value->>'target_sets')::numeric > 0
    on conflict (weekly_routine_id, muscle_id)
      do update set target_sets_per_week = excluded.target_sets_per_week;
  end if;

  return v_weekly_routine_id;
end;
$$;
