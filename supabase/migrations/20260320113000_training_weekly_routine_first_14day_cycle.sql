-- Weekly-routine-first flow: allow 14-day cycles and create one default microcycle per new routine.

alter table public.mesocycles
  drop constraint if exists mesocycles_sessions_per_week_check;

alter table public.mesocycles
  add constraint mesocycles_sessions_per_week_check
  check (
    sessions_per_week is null
    or (sessions_per_week >= 1 and sessions_per_week <= 14)
  );

alter table public.training_weekly_routines
  drop constraint if exists training_weekly_routines_sessions_per_week_check;

alter table public.training_weekly_routines
  add constraint training_weekly_routines_sessions_per_week_check
  check (sessions_per_week >= 1 and sessions_per_week <= 14);

alter table public.training_weekly_days
  drop constraint if exists training_weekly_days_day_index_check;

alter table public.training_weekly_days
  add constraint training_weekly_days_day_index_check
  check (day_index >= 1 and day_index <= 14);

create or replace function public.training_create_weekly_routine_quickstart_v2(
  p_weekly_routine_name text default null,
  p_cycle_days integer default null,
  p_days jsonb default '[]'::jsonb,
  p_objective_id bigint default null,
  p_start_date date default current_date,
  p_user_id uuid default auth.uid()
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

  if v_days_count < 4 or v_days_count > 14 then
    raise exception 'p_cycle_days must be between 4 and 14';
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
            notes
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
            nullif(trim(coalesce(x.value->>'notes', '')), '')
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

  return v_mesocycle_id;
end;
$$;

grant execute on function public.training_create_weekly_routine_quickstart_v2(text,integer,jsonb,bigint,date,uuid) to anon, authenticated, service_role;
