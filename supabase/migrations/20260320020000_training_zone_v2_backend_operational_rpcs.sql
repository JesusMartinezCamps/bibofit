-- Training Zone V2 operational backend layer
-- Provides secure RPCs and consistency guardrails for:
-- mesocycle -> weekly routine -> day -> block -> block exercises -> microcycles -> workouts

-- 1) Shared permission helper
create or replace function public.training_can_manage_user(p_target_user_id uuid)
returns boolean
language sql
stable
as $$
  select
    coalesce(auth.role(), '') = 'service_role'
    or (
      auth.uid() is not null
      and (
        auth.uid() = p_target_user_id
        or exists (
          select 1
          from public.user_roles ur
          join public.roles r on r.id = ur.role_id
          where ur.user_id = auth.uid()
            and r.role = 'admin'
        )
        or exists (
          select 1
          from public.coach_clients cc
          where cc.coach_id = auth.uid()
            and cc.client_id = p_target_user_id
        )
      )
    );
$$;

-- 2) Guardrail: workouts links must be internally consistent
create or replace function public.validate_workout_training_links()
returns trigger
language plpgsql
as $$
declare
  v_routine_mesocycle_id bigint;
  v_routine_user_id uuid;
  v_day_routine_id bigint;
  v_day_mesocycle_id bigint;
  v_day_user_id uuid;
  v_microcycle_mesocycle_id bigint;
  v_microcycle_user_id uuid;
begin
  if new.training_weekly_routine_id is not null then
    select twr.mesocycle_id, m.user_id
    into v_routine_mesocycle_id, v_routine_user_id
    from public.training_weekly_routines twr
    join public.mesocycles m on m.id = twr.mesocycle_id
    where twr.id = new.training_weekly_routine_id;

    if v_routine_mesocycle_id is null then
      raise exception 'training_weekly_routine_id % not found', new.training_weekly_routine_id;
    end if;
  end if;

  if new.training_weekly_day_id is not null then
    select twd.weekly_routine_id, twr.mesocycle_id, m.user_id
    into v_day_routine_id, v_day_mesocycle_id, v_day_user_id
    from public.training_weekly_days twd
    join public.training_weekly_routines twr on twr.id = twd.weekly_routine_id
    join public.mesocycles m on m.id = twr.mesocycle_id
    where twd.id = new.training_weekly_day_id;

    if v_day_routine_id is null then
      raise exception 'training_weekly_day_id % not found', new.training_weekly_day_id;
    end if;

    if new.training_weekly_routine_id is null then
      new.training_weekly_routine_id := v_day_routine_id;
      v_routine_mesocycle_id := v_day_mesocycle_id;
      v_routine_user_id := v_day_user_id;
    elsif new.training_weekly_routine_id <> v_day_routine_id then
      raise exception 'training_weekly_day_id % belongs to routine %, got routine %',
        new.training_weekly_day_id, v_day_routine_id, new.training_weekly_routine_id;
    end if;

    if v_routine_mesocycle_id is not null and v_day_mesocycle_id is not null and v_routine_mesocycle_id <> v_day_mesocycle_id then
      raise exception 'training_weekly_day_id % and training_weekly_routine_id % belong to different mesocycles',
        new.training_weekly_day_id, new.training_weekly_routine_id;
    end if;

    if new.user_id is null then
      new.user_id := v_day_user_id;
    elsif new.user_id <> v_day_user_id then
      raise exception 'workout user_id % does not match day owner user_id %', new.user_id, v_day_user_id;
    end if;
  end if;

  if new.training_weekly_routine_id is not null then
    if new.user_id is null then
      new.user_id := v_routine_user_id;
    elsif v_routine_user_id is not null and new.user_id <> v_routine_user_id then
      raise exception 'workout user_id % does not match routine owner user_id %', new.user_id, v_routine_user_id;
    end if;
  end if;

  if new.training_microcycle_id is not null then
    select tm.mesocycle_id, m.user_id
    into v_microcycle_mesocycle_id, v_microcycle_user_id
    from public.training_microcycles tm
    join public.mesocycles m on m.id = tm.mesocycle_id
    where tm.id = new.training_microcycle_id;

    if v_microcycle_mesocycle_id is null then
      raise exception 'training_microcycle_id % not found', new.training_microcycle_id;
    end if;

    if v_routine_mesocycle_id is not null and v_microcycle_mesocycle_id <> v_routine_mesocycle_id then
      raise exception 'training_microcycle_id % and training_weekly_routine_id % belong to different mesocycles',
        new.training_microcycle_id, new.training_weekly_routine_id;
    end if;

    if v_day_mesocycle_id is not null and v_microcycle_mesocycle_id <> v_day_mesocycle_id then
      raise exception 'training_microcycle_id % and training_weekly_day_id % belong to different mesocycles',
        new.training_microcycle_id, new.training_weekly_day_id;
    end if;

    if new.user_id is null then
      new.user_id := v_microcycle_user_id;
    elsif new.user_id <> v_microcycle_user_id then
      raise exception 'workout user_id % does not match microcycle owner user_id %', new.user_id, v_microcycle_user_id;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_workout_training_links on public.workouts;
create trigger trg_validate_workout_training_links
before insert or update of user_id, training_microcycle_id, training_weekly_routine_id, training_weekly_day_id
on public.workouts
for each row
execute function public.validate_workout_training_links();

-- 3) Guardrail: workout_exercises links must be internally consistent
create or replace function public.validate_workout_exercise_training_links()
returns trigger
language plpgsql
as $$
declare
  v_block_id bigint;
  v_block_exercise_exercise_id bigint;
  v_block_day_id bigint;
  v_workout_day_id bigint;
begin
  if new.training_block_exercise_id is not null then
    select tbe.weekly_day_block_id, tbe.exercise_id
    into v_block_id, v_block_exercise_exercise_id
    from public.training_block_exercises tbe
    where tbe.id = new.training_block_exercise_id;

    if v_block_id is null then
      raise exception 'training_block_exercise_id % not found', new.training_block_exercise_id;
    end if;

    if new.training_weekly_day_block_id is null then
      new.training_weekly_day_block_id := v_block_id;
    elsif new.training_weekly_day_block_id <> v_block_id then
      raise exception 'training_block_exercise_id % belongs to block %, got block %',
        new.training_block_exercise_id, v_block_id, new.training_weekly_day_block_id;
    end if;

    if new.exercise_id is null then
      new.exercise_id := v_block_exercise_exercise_id;
    elsif new.exercise_id <> v_block_exercise_exercise_id then
      raise exception 'training_block_exercise_id % points to exercise %, got exercise %',
        new.training_block_exercise_id, v_block_exercise_exercise_id, new.exercise_id;
    end if;
  end if;

  if new.training_weekly_day_block_id is not null then
    select twdb.weekly_day_id
    into v_block_day_id
    from public.training_weekly_day_blocks twdb
    where twdb.id = new.training_weekly_day_block_id;

    if v_block_day_id is null then
      raise exception 'training_weekly_day_block_id % not found', new.training_weekly_day_block_id;
    end if;

    if new.workout_id is not null then
      select w.training_weekly_day_id
      into v_workout_day_id
      from public.workouts w
      where w.id = new.workout_id;

      if not found then
        raise exception 'workout_id % not found', new.workout_id;
      end if;

      if v_workout_day_id is not null and v_workout_day_id <> v_block_day_id then
        raise exception 'workout_id % is linked to day %, but block % belongs to day %',
          new.workout_id, v_workout_day_id, new.training_weekly_day_block_id, v_block_day_id;
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_workout_exercise_training_links on public.workout_exercises;
create trigger trg_validate_workout_exercise_training_links
before insert or update of workout_id, training_weekly_day_block_id, training_block_exercise_id, exercise_id
on public.workout_exercises
for each row
execute function public.validate_workout_exercise_training_links();

-- 4) Create a full V2 mesocycle blueprint (mesocycle + weekly structure + optional microcycles/focuses)
create or replace function public.training_create_mesocycle_blueprint_v2(
  p_name text,
  p_objective_id bigint,
  p_start_date date,
  p_end_date date,
  p_days jsonb,
  p_user_id uuid default auth.uid(),
  p_weekly_routine_name text default null,
  p_microcycles jsonb default '[]'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_user_id uuid := coalesce(p_user_id, auth.uid());
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
  v_microcycle jsonb;
  v_microcycle_idx integer := 0;
  v_microcycle_id bigint;
  v_microcycle_name text;
  v_microcycle_start date;
  v_microcycle_end date;
  v_microcycle_objective_id bigint;
  v_focus jsonb;
  v_focus_type text;
  v_focus_day_index integer;
  v_focus_block_order integer;
  v_focus_weekly_day_block_id bigint;
  v_focus_movement_pattern_id bigint;
  v_focus_muscle_id bigint;
  v_focus_joint_id bigint;
  v_focus_exercise_id bigint;
  v_focus_key_exercise_id bigint;
begin
  if v_target_user_id is null then
    raise exception 'p_user_id is required';
  end if;

  if not public.training_can_manage_user(v_target_user_id) then
    raise exception 'not allowed to create training blueprint for user %', v_target_user_id;
  end if;

  if p_objective_id is null then
    raise exception 'p_objective_id is required';
  end if;

  select o.name
  into v_objective_name
  from public.training_objectives o
  where o.id = p_objective_id
    and o.is_active;

  if v_objective_name is null then
    raise exception 'invalid p_objective_id %', p_objective_id;
  end if;

  if p_days is null or jsonb_typeof(p_days) <> 'array' or jsonb_array_length(p_days) = 0 then
    raise exception 'p_days must be a non-empty JSON array';
  end if;

  if jsonb_array_length(p_days) > 7 then
    raise exception 'p_days cannot exceed 7';
  end if;

  if p_start_date is not null and p_end_date is not null and p_end_date < p_start_date then
    raise exception 'p_end_date cannot be before p_start_date';
  end if;

  if p_microcycles is not null and jsonb_typeof(p_microcycles) <> 'array' then
    raise exception 'p_microcycles must be a JSON array';
  end if;

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
    nullif(trim(coalesce(p_name, '')), ''),
    v_objective_name,
    p_objective_id,
    p_start_date,
    p_end_date,
    jsonb_array_length(p_days)
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
    coalesce(nullif(trim(coalesce(p_weekly_routine_name, '')), ''), 'Rutina semanal'),
    jsonb_array_length(p_days),
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
            coalesce(nullif(trim(coalesce(x.value->>'is_key_exercise', '')), '')::boolean, false),
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

  -- Explicit microcycles from payload.
  if p_microcycles is not null
    and jsonb_typeof(p_microcycles) = 'array'
    and jsonb_array_length(p_microcycles) > 0 then
    for v_microcycle in
      select value from jsonb_array_elements(p_microcycles)
    loop
      v_microcycle_idx := v_microcycle_idx + 1;
      v_microcycle_name := coalesce(nullif(trim(coalesce(v_microcycle->>'name', '')), ''), 'Microciclo ' || v_microcycle_idx::text);
      v_microcycle_start := coalesce(nullif(trim(coalesce(v_microcycle->>'start_date', '')), '')::date, p_start_date);
      v_microcycle_end := coalesce(nullif(trim(coalesce(v_microcycle->>'end_date', '')), '')::date, p_end_date);
      v_microcycle_objective_id := coalesce(nullif(trim(coalesce(v_microcycle->>'objective_id', '')), '')::bigint, p_objective_id);

      if v_microcycle_start is null or v_microcycle_end is null then
        raise exception 'microcycle % must define start_date and end_date (directly or from mesocycle)', v_microcycle_idx;
      end if;

      if v_microcycle_end < v_microcycle_start then
        raise exception 'microcycle % end_date cannot be before start_date', v_microcycle_idx;
      end if;

      if p_start_date is not null and v_microcycle_start < p_start_date then
        raise exception 'microcycle % starts before mesocycle start_date', v_microcycle_idx;
      end if;

      if p_end_date is not null and v_microcycle_end > p_end_date then
        raise exception 'microcycle % ends after mesocycle end_date', v_microcycle_idx;
      end if;

      if v_microcycle_objective_id is not null and not exists (
        select 1
        from public.training_objectives o
        where o.id = v_microcycle_objective_id
          and o.is_active
      ) then
        raise exception 'invalid objective_id % in microcycle %', v_microcycle_objective_id, v_microcycle_idx;
      end if;

      insert into public.training_microcycles (
        mesocycle_id,
        sequence_index,
        name,
        objective_id,
        objective_notes,
        start_date,
        end_date,
        deload_week
      )
      values (
        v_mesocycle_id,
        v_microcycle_idx,
        v_microcycle_name,
        v_microcycle_objective_id,
        nullif(trim(coalesce(v_microcycle->>'objective_notes', '')), ''),
        v_microcycle_start,
        v_microcycle_end,
        coalesce(nullif(trim(coalesce(v_microcycle->>'deload_week', '')), '')::boolean, false)
      )
      returning id into v_microcycle_id;

      if v_microcycle ? 'focuses'
        and jsonb_typeof(v_microcycle->'focuses') = 'array'
        and jsonb_array_length(v_microcycle->'focuses') > 0 then
        for v_focus in
          select value from jsonb_array_elements(v_microcycle->'focuses')
        loop
          v_focus_day_index := nullif(trim(coalesce(v_focus->>'day_index', '')), '')::integer;
          v_focus_block_order := nullif(trim(coalesce(v_focus->>'block_order', '')), '')::integer;

          if v_focus_day_index is null or v_focus_block_order is null then
            raise exception 'focus in microcycle % requires day_index and block_order', v_microcycle_idx;
          end if;

          select twdb.id
          into v_focus_weekly_day_block_id
          from public.training_weekly_day_blocks twdb
          join public.training_weekly_days twd on twd.id = twdb.weekly_day_id
          where twd.weekly_routine_id = v_weekly_routine_id
            and twd.day_index = v_focus_day_index
            and twdb.block_order = v_focus_block_order;

          if v_focus_weekly_day_block_id is null then
            raise exception 'focus references unknown block day_index %, block_order %', v_focus_day_index, v_focus_block_order;
          end if;

          v_focus_movement_pattern_id := nullif(trim(coalesce(v_focus->>'movement_pattern_id', '')), '')::bigint;
          v_focus_muscle_id := nullif(trim(coalesce(v_focus->>'muscle_id', '')), '')::bigint;
          v_focus_joint_id := nullif(trim(coalesce(v_focus->>'joint_id', '')), '')::bigint;
          v_focus_exercise_id := nullif(trim(coalesce(v_focus->>'focus_exercise_id', '')), '')::bigint;
          v_focus_key_exercise_id := nullif(trim(coalesce(v_focus->>'key_exercise_id', '')), '')::bigint;

          v_focus_type := lower(trim(coalesce(v_focus->>'focus_type', '')));
          if v_focus_type = '' then
            if v_focus_movement_pattern_id is not null then
              v_focus_type := 'movement_pattern';
            elsif v_focus_muscle_id is not null then
              v_focus_type := 'muscle';
            elsif v_focus_joint_id is not null then
              v_focus_type := 'joint';
            elsif v_focus_exercise_id is not null then
              v_focus_type := 'exercise';
            else
              raise exception 'focus in microcycle % must define focus_type or a focus target id', v_microcycle_idx;
            end if;
          end if;

          insert into public.training_microcycle_block_focuses (
            microcycle_id,
            weekly_day_block_id,
            focus_type,
            movement_pattern_id,
            muscle_id,
            joint_id,
            focus_exercise_id,
            key_exercise_id,
            notes
          )
          values (
            v_microcycle_id,
            v_focus_weekly_day_block_id,
            v_focus_type,
            v_focus_movement_pattern_id,
            v_focus_muscle_id,
            v_focus_joint_id,
            v_focus_exercise_id,
            v_focus_key_exercise_id,
            nullif(trim(coalesce(v_focus->>'notes', '')), '')
          );
        end loop;
      end if;
    end loop;

  -- If no microcycles payload was provided, bootstrap one default microcycle when date range exists.
  elsif p_start_date is not null and p_end_date is not null then
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
      p_objective_id,
      p_start_date,
      p_end_date,
      false
    );
  end if;

  return v_mesocycle_id;
end;
$$;

-- 5) Replace the full exercise list of one block in a single atomic call
create or replace function public.training_replace_block_exercises(
  p_weekly_day_block_id bigint,
  p_exercises jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_user_id uuid;
  v_inserted integer := 0;
begin
  if p_weekly_day_block_id is null then
    raise exception 'p_weekly_day_block_id is required';
  end if;

  if p_exercises is null or jsonb_typeof(p_exercises) <> 'array' then
    raise exception 'p_exercises must be a JSON array';
  end if;

  select m.user_id
  into v_owner_user_id
  from public.training_weekly_day_blocks twdb
  join public.training_weekly_days twd on twd.id = twdb.weekly_day_id
  join public.training_weekly_routines twr on twr.id = twd.weekly_routine_id
  join public.mesocycles m on m.id = twr.mesocycle_id
  where twdb.id = p_weekly_day_block_id;

  if v_owner_user_id is null then
    raise exception 'weekly_day_block_id % not found', p_weekly_day_block_id;
  end if;

  if not public.training_can_manage_user(v_owner_user_id) then
    raise exception 'not allowed to update weekly_day_block_id %', p_weekly_day_block_id;
  end if;

  delete from public.training_block_exercises
  where weekly_day_block_id = p_weekly_day_block_id;

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
    p_weekly_day_block_id,
    nullif(trim(coalesce(x.value->>'exercise_id', '')), '')::bigint,
    x.ordinality::integer,
    nullif(trim(coalesce(x.value->>'preferred_equipment_id', '')), '')::bigint,
    coalesce(nullif(trim(coalesce(x.value->>'target_sets', '')), '')::integer, 3),
    coalesce(nullif(trim(coalesce(x.value->>'target_reps_min', '')), '')::integer, 8),
    coalesce(nullif(trim(coalesce(x.value->>'target_reps_max', '')), '')::integer, 12),
    coalesce(nullif(trim(coalesce(x.value->>'progression_increment_kg', '')), '')::integer, 5),
    coalesce(nullif(trim(coalesce(x.value->>'backoff_percentage', '')), '')::numeric, 0.800),
    coalesce(nullif(trim(coalesce(x.value->>'is_key_exercise', '')), '')::boolean, false),
    nullif(trim(coalesce(x.value->>'notes', '')), '')
  from jsonb_array_elements(p_exercises) with ordinality as x(value, ordinality)
  where nullif(trim(coalesce(x.value->>'exercise_id', '')), '') is not null;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

-- 6) Replace the full focus list of one microcycle in a single atomic call
create or replace function public.training_replace_microcycle_focuses(
  p_microcycle_id bigint,
  p_focuses jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mesocycle_id bigint;
  v_owner_user_id uuid;
  v_focus jsonb;
  v_focus_type text;
  v_focus_weekly_day_block_id bigint;
  v_focus_day_index integer;
  v_focus_block_order integer;
  v_focus_movement_pattern_id bigint;
  v_focus_muscle_id bigint;
  v_focus_joint_id bigint;
  v_focus_exercise_id bigint;
  v_focus_key_exercise_id bigint;
  v_inserted integer := 0;
begin
  if p_microcycle_id is null then
    raise exception 'p_microcycle_id is required';
  end if;

  if p_focuses is null or jsonb_typeof(p_focuses) <> 'array' then
    raise exception 'p_focuses must be a JSON array';
  end if;

  select tm.mesocycle_id, m.user_id
  into v_mesocycle_id, v_owner_user_id
  from public.training_microcycles tm
  join public.mesocycles m on m.id = tm.mesocycle_id
  where tm.id = p_microcycle_id;

  if v_mesocycle_id is null then
    raise exception 'microcycle_id % not found', p_microcycle_id;
  end if;

  if not public.training_can_manage_user(v_owner_user_id) then
    raise exception 'not allowed to update microcycle_id %', p_microcycle_id;
  end if;

  delete from public.training_microcycle_block_focuses
  where microcycle_id = p_microcycle_id;

  for v_focus in
    select value from jsonb_array_elements(p_focuses)
  loop
    v_focus_weekly_day_block_id := nullif(trim(coalesce(v_focus->>'weekly_day_block_id', '')), '')::bigint;
    v_focus_day_index := nullif(trim(coalesce(v_focus->>'day_index', '')), '')::integer;
    v_focus_block_order := nullif(trim(coalesce(v_focus->>'block_order', '')), '')::integer;

    if v_focus_weekly_day_block_id is null then
      if v_focus_day_index is null or v_focus_block_order is null then
        raise exception 'focus requires weekly_day_block_id or (day_index + block_order)';
      end if;

      select twdb.id
      into v_focus_weekly_day_block_id
      from public.training_weekly_day_blocks twdb
      join public.training_weekly_days twd on twd.id = twdb.weekly_day_id
      join public.training_weekly_routines twr on twr.id = twd.weekly_routine_id
      where twr.mesocycle_id = v_mesocycle_id
        and twd.day_index = v_focus_day_index
        and twdb.block_order = v_focus_block_order;

      if v_focus_weekly_day_block_id is null then
        raise exception 'focus references unknown block for day_index %, block_order %',
          v_focus_day_index, v_focus_block_order;
      end if;
    else
      perform 1
      from public.training_weekly_day_blocks twdb
      join public.training_weekly_days twd on twd.id = twdb.weekly_day_id
      join public.training_weekly_routines twr on twr.id = twd.weekly_routine_id
      where twdb.id = v_focus_weekly_day_block_id
        and twr.mesocycle_id = v_mesocycle_id;

      if not found then
        raise exception 'weekly_day_block_id % does not belong to microcycle mesocycle', v_focus_weekly_day_block_id;
      end if;
    end if;

    v_focus_movement_pattern_id := nullif(trim(coalesce(v_focus->>'movement_pattern_id', '')), '')::bigint;
    v_focus_muscle_id := nullif(trim(coalesce(v_focus->>'muscle_id', '')), '')::bigint;
    v_focus_joint_id := nullif(trim(coalesce(v_focus->>'joint_id', '')), '')::bigint;
    v_focus_exercise_id := nullif(trim(coalesce(v_focus->>'focus_exercise_id', '')), '')::bigint;
    v_focus_key_exercise_id := nullif(trim(coalesce(v_focus->>'key_exercise_id', '')), '')::bigint;

    v_focus_type := lower(trim(coalesce(v_focus->>'focus_type', '')));
    if v_focus_type = '' then
      if v_focus_movement_pattern_id is not null then
        v_focus_type := 'movement_pattern';
      elsif v_focus_muscle_id is not null then
        v_focus_type := 'muscle';
      elsif v_focus_joint_id is not null then
        v_focus_type := 'joint';
      elsif v_focus_exercise_id is not null then
        v_focus_type := 'exercise';
      else
        raise exception 'focus must define focus_type or a focus target id';
      end if;
    end if;

    insert into public.training_microcycle_block_focuses (
      microcycle_id,
      weekly_day_block_id,
      focus_type,
      movement_pattern_id,
      muscle_id,
      joint_id,
      focus_exercise_id,
      key_exercise_id,
      notes
    )
    values (
      p_microcycle_id,
      v_focus_weekly_day_block_id,
      v_focus_type,
      v_focus_movement_pattern_id,
      v_focus_muscle_id,
      v_focus_joint_id,
      v_focus_exercise_id,
      v_focus_key_exercise_id,
      nullif(trim(coalesce(v_focus->>'notes', '')), '')
    );

    v_inserted := v_inserted + 1;
  end loop;

  return v_inserted;
end;
$$;

-- 7) Resolve next session day in the active mesocycle cycle
create or replace function public.training_get_next_session_day(
  p_user_id uuid default auth.uid(),
  p_on_date date default current_date
)
returns table (
  user_id uuid,
  mesocycle_id bigint,
  mesocycle_name text,
  mesocycle_objective_id bigint,
  mesocycle_objective text,
  weekly_routine_id bigint,
  weekly_routine_name text,
  weekly_day_id bigint,
  weekly_day_index integer,
  weekly_day_name text,
  microcycle_id bigint,
  microcycle_name text,
  last_workout_id bigint,
  last_workout_date date
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_user_id uuid := coalesce(p_user_id, auth.uid());
  v_check_date date := coalesce(p_on_date, current_date);
  v_mesocycle_id bigint;
  v_mesocycle_name text;
  v_mesocycle_objective_id bigint;
  v_mesocycle_objective text;
  v_weekly_routine_id bigint;
  v_weekly_routine_name text;
  v_last_workout_id bigint;
  v_last_workout_date date;
  v_last_day_index integer;
  v_weekly_day_id bigint;
  v_weekly_day_index integer;
  v_weekly_day_name text;
  v_microcycle_id bigint;
  v_microcycle_name text;
begin
  if v_target_user_id is null then
    raise exception 'p_user_id is required';
  end if;

  if not public.training_can_manage_user(v_target_user_id) then
    raise exception 'not allowed to read training plan for user %', v_target_user_id;
  end if;

  select m.id, m.name, m.objective_id, m.objective
  into v_mesocycle_id, v_mesocycle_name, v_mesocycle_objective_id, v_mesocycle_objective
  from public.mesocycles m
  where m.user_id = v_target_user_id
    and (m.start_date is null or m.start_date <= v_check_date)
    and (m.end_date is null or m.end_date >= v_check_date)
  order by m.start_date desc nulls last, m.id desc
  limit 1;

  if v_mesocycle_id is null then
    -- Fallback: latest mesocycle for user even if out of date range
    select m.id, m.name, m.objective_id, m.objective
    into v_mesocycle_id, v_mesocycle_name, v_mesocycle_objective_id, v_mesocycle_objective
    from public.mesocycles m
    where m.user_id = v_target_user_id
    order by m.start_date desc nulls last, m.id desc
    limit 1;
  end if;

  if v_mesocycle_id is null then
    return;
  end if;

  select twr.id, twr.name
  into v_weekly_routine_id, v_weekly_routine_name
  from public.training_weekly_routines twr
  where twr.mesocycle_id = v_mesocycle_id
  order by twr.is_default desc, twr.id asc
  limit 1;

  if v_weekly_routine_id is null then
    return;
  end if;

  select w.id, w.performed_on, twd.day_index
  into v_last_workout_id, v_last_workout_date, v_last_day_index
  from public.workouts w
  left join public.training_weekly_days twd on twd.id = w.training_weekly_day_id
  where w.user_id = v_target_user_id
    and w.training_weekly_routine_id = v_weekly_routine_id
  order by w.performed_on desc nulls last, w.id desc
  limit 1;

  if v_last_day_index is null then
    select twd.id, twd.day_index, twd.name
    into v_weekly_day_id, v_weekly_day_index, v_weekly_day_name
    from public.training_weekly_days twd
    where twd.weekly_routine_id = v_weekly_routine_id
    order by twd.day_index asc, twd.id asc
    limit 1;
  else
    select twd.id, twd.day_index, twd.name
    into v_weekly_day_id, v_weekly_day_index, v_weekly_day_name
    from public.training_weekly_days twd
    where twd.weekly_routine_id = v_weekly_routine_id
      and twd.day_index > v_last_day_index
    order by twd.day_index asc, twd.id asc
    limit 1;

    if v_weekly_day_id is null then
      select twd.id, twd.day_index, twd.name
      into v_weekly_day_id, v_weekly_day_index, v_weekly_day_name
      from public.training_weekly_days twd
      where twd.weekly_routine_id = v_weekly_routine_id
      order by twd.day_index asc, twd.id asc
      limit 1;
    end if;
  end if;

  select tm.id, tm.name
  into v_microcycle_id, v_microcycle_name
  from public.training_microcycles tm
  where tm.mesocycle_id = v_mesocycle_id
    and tm.start_date <= v_check_date
    and tm.end_date >= v_check_date
  order by tm.sequence_index desc, tm.id desc
  limit 1;

  if v_microcycle_id is null then
    select tm.id, tm.name
    into v_microcycle_id, v_microcycle_name
    from public.training_microcycles tm
    where tm.mesocycle_id = v_mesocycle_id
      and tm.start_date <= v_check_date
    order by tm.start_date desc, tm.sequence_index desc, tm.id desc
    limit 1;
  end if;

  if v_microcycle_id is null then
    select tm.id, tm.name
    into v_microcycle_id, v_microcycle_name
    from public.training_microcycles tm
    where tm.mesocycle_id = v_mesocycle_id
    order by tm.sequence_index asc, tm.id asc
    limit 1;
  end if;

  return query
  select
    v_target_user_id,
    v_mesocycle_id,
    v_mesocycle_name,
    v_mesocycle_objective_id,
    v_mesocycle_objective,
    v_weekly_routine_id,
    v_weekly_routine_name,
    v_weekly_day_id,
    v_weekly_day_index,
    v_weekly_day_name,
    v_microcycle_id,
    v_microcycle_name,
    v_last_workout_id,
    v_last_workout_date;
end;
$$;

-- 8) Create a workout from one training day with progression-aware target weights
create or replace function public.training_create_workout_from_day(
  p_training_weekly_day_id bigint,
  p_performed_on date default current_date,
  p_user_id uuid default auth.uid(),
  p_force_new boolean default false
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_user_id uuid := coalesce(p_user_id, auth.uid());
  v_owner_user_id uuid;
  v_mesocycle_id bigint;
  v_weekly_routine_id bigint;
  v_workout_id bigint;
  v_workout_exercise_id bigint;
  v_performed_on date := coalesce(p_performed_on, current_date);
  v_microcycle_id bigint;
  v_sequence integer := 0;
  v_equipment_id bigint;
  v_top_weight integer;
  v_backoff_weight integer;
  rec record;
begin
  if p_training_weekly_day_id is null then
    raise exception 'p_training_weekly_day_id is required';
  end if;

  select m.user_id, twr.mesocycle_id, twd.weekly_routine_id
  into v_owner_user_id, v_mesocycle_id, v_weekly_routine_id
  from public.training_weekly_days twd
  join public.training_weekly_routines twr on twr.id = twd.weekly_routine_id
  join public.mesocycles m on m.id = twr.mesocycle_id
  where twd.id = p_training_weekly_day_id;

  if v_owner_user_id is null then
    raise exception 'training_weekly_day_id % not found', p_training_weekly_day_id;
  end if;

  if v_target_user_id is null then
    v_target_user_id := v_owner_user_id;
  end if;

  if v_target_user_id <> v_owner_user_id then
    raise exception 'training_weekly_day_id % belongs to user %, got user %',
      p_training_weekly_day_id, v_owner_user_id, v_target_user_id;
  end if;

  if not public.training_can_manage_user(v_owner_user_id) then
    raise exception 'not allowed to create workout for user %', v_owner_user_id;
  end if;

  if not coalesce(p_force_new, false) then
    select w.id
    into v_workout_id
    from public.workouts w
    where w.user_id = v_owner_user_id
      and w.training_weekly_day_id = p_training_weekly_day_id
      and w.performed_on = v_performed_on
    order by w.id desc
    limit 1;

    if v_workout_id is not null then
      return v_workout_id;
    end if;
  end if;

  select tm.id
  into v_microcycle_id
  from public.training_microcycles tm
  where tm.mesocycle_id = v_mesocycle_id
    and tm.start_date <= v_performed_on
    and tm.end_date >= v_performed_on
  order by tm.sequence_index desc, tm.id desc
  limit 1;

  if v_microcycle_id is null then
    select tm.id
    into v_microcycle_id
    from public.training_microcycles tm
    where tm.mesocycle_id = v_mesocycle_id
      and tm.start_date <= v_performed_on
    order by tm.start_date desc, tm.sequence_index desc, tm.id desc
    limit 1;
  end if;

  if v_microcycle_id is null then
    select tm.id
    into v_microcycle_id
    from public.training_microcycles tm
    where tm.mesocycle_id = v_mesocycle_id
    order by tm.sequence_index asc, tm.id asc
    limit 1;
  end if;

  insert into public.workouts (
    user_id,
    routine_id,
    performed_on,
    training_microcycle_id,
    training_weekly_routine_id,
    training_weekly_day_id
  )
  values (
    v_owner_user_id,
    null,
    v_performed_on,
    v_microcycle_id,
    v_weekly_routine_id,
    p_training_weekly_day_id
  )
  returning id into v_workout_id;

  for rec in
    select
      twdb.id as weekly_day_block_id,
      twdb.block_order,
      tbe.id as block_exercise_id,
      tbe.exercise_order,
      tbe.exercise_id,
      tbe.preferred_equipment_id,
      tbe.target_sets,
      tbe.target_reps_min,
      tbe.target_reps_max,
      tbe.progression_increment_kg,
      tbe.backoff_percentage,
      e.equipment_id as default_equipment_id,
      e.default_weight
    from public.training_weekly_day_blocks twdb
    join public.training_block_exercises tbe on tbe.weekly_day_block_id = twdb.id
    join public.exercises e on e.id = tbe.exercise_id
    where twdb.weekly_day_id = p_training_weekly_day_id
    order by twdb.block_order asc, tbe.exercise_order asc, tbe.id asc
  loop
    v_sequence := v_sequence + 1;
    v_equipment_id := coalesce(rec.preferred_equipment_id, rec.default_equipment_id);

    v_top_weight := public.suggest_next_top_set_weight(
      v_owner_user_id,
      rec.exercise_id,
      v_equipment_id,
      rec.target_reps_max,
      rec.progression_increment_kg
    );

    if v_top_weight is null then
      v_top_weight := coalesce(rec.default_weight, 0);
    end if;

    v_top_weight := greatest(v_top_weight, 0);
    v_backoff_weight := greatest(round(v_top_weight * rec.backoff_percentage)::integer, 0);

    insert into public.workout_exercises (
      workout_id,
      exercise_id,
      sequence,
      performed_equipment_id,
      prescribed_sets,
      prescribed_reps_min,
      prescribed_reps_max,
      prescribed_increment_kg,
      prescribed_backoff_percentage,
      training_weekly_day_block_id,
      training_block_exercise_id
    )
    values (
      v_workout_id,
      rec.exercise_id,
      v_sequence,
      v_equipment_id,
      rec.target_sets,
      rec.target_reps_min,
      rec.target_reps_max,
      rec.progression_increment_kg,
      rec.backoff_percentage,
      rec.weekly_day_block_id,
      rec.block_exercise_id
    )
    returning id into v_workout_exercise_id;

    insert into public.exercise_sets (
      workout_exercise_id,
      set_no,
      target_reps_min,
      target_reps_max,
      target_weight,
      is_warmup
    )
    select
      v_workout_exercise_id,
      gs,
      rec.target_reps_min,
      rec.target_reps_max,
      case when gs = 1 then v_top_weight else v_backoff_weight end,
      false
    from generate_series(1, rec.target_sets) as gs
    on conflict (workout_exercise_id, set_no) where set_no is not null do update
    set target_reps_min = excluded.target_reps_min,
        target_reps_max = excluded.target_reps_max,
        target_weight = excluded.target_weight,
        is_warmup = excluded.is_warmup;
  end loop;

  return v_workout_id;
end;
$$;

-- 9) Convenience wrapper: create workout for the day that comes next in the cycle
create or replace function public.training_create_next_workout(
  p_user_id uuid default auth.uid(),
  p_performed_on date default current_date,
  p_force_new boolean default false
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next_weekly_day_id bigint;
begin
  select t.weekly_day_id
  into v_next_weekly_day_id
  from public.training_get_next_session_day(p_user_id, p_performed_on) t
  limit 1;

  if v_next_weekly_day_id is null then
    raise exception 'no active training day found for this user';
  end if;

  return public.training_create_workout_from_day(
    v_next_weekly_day_id,
    p_performed_on,
    p_user_id,
    p_force_new
  );
end;
$$;

-- 10) Session payload with history ready for mobile-first workout UX
create or replace function public.training_get_workout_session_payload(
  p_workout_id bigint,
  p_user_id uuid default auth.uid()
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
  if p_workout_id is null then
    raise exception 'p_workout_id is required';
  end if;

  select w.user_id
  into v_owner_user_id
  from public.workouts w
  where w.id = p_workout_id;

  if v_owner_user_id is null then
    raise exception 'workout_id % not found', p_workout_id;
  end if;

  if p_user_id is not null and p_user_id <> v_owner_user_id then
    raise exception 'workout_id % belongs to user %, got user %', p_workout_id, v_owner_user_id, p_user_id;
  end if;

  if not public.training_can_manage_user(v_owner_user_id) then
    raise exception 'not allowed to read workout_id %', p_workout_id;
  end if;

  with workout_base as (
    select
      w.id,
      w.user_id,
      w.performed_on,
      w.training_microcycle_id,
      tm.name as training_microcycle_name,
      w.training_weekly_routine_id,
      twr.name as training_weekly_routine_name,
      w.training_weekly_day_id,
      twd.day_index as training_weekly_day_index,
      twd.name as training_weekly_day_name
    from public.workouts w
    left join public.training_microcycles tm on tm.id = w.training_microcycle_id
    left join public.training_weekly_routines twr on twr.id = w.training_weekly_routine_id
    left join public.training_weekly_days twd on twd.id = w.training_weekly_day_id
    where w.id = p_workout_id
  ),
  exercise_rows as (
    select
      we.id as workout_exercise_id,
      we.sequence,
      we.exercise_id,
      e.name as exercise_name,
      e.technique as exercise_technique,
      we.performed_equipment_id,
      eq.name as performed_equipment_name,
      we.training_weekly_day_block_id,
      twdb.block_order,
      twdb.block_type,
      twdb.name as block_name,
      we.training_block_exercise_id,
      we.prescribed_sets,
      we.prescribed_reps_min,
      we.prescribed_reps_max,
      we.prescribed_increment_kg,
      we.prescribed_backoff_percentage,
      coalesce(curr_sets.sets, '[]'::jsonb) as set_rows,
      case
        when prev.prev_workout_exercise_id is null then null
        else jsonb_build_object(
          'workout_exercise_id', prev.prev_workout_exercise_id,
          'performed_on', prev.prev_performed_on,
          'performed_equipment_id', prev.prev_equipment_id,
          'performed_equipment_name', prev.prev_equipment_name,
          'equipment_match', (
            we.performed_equipment_id is not null
            and prev.prev_equipment_id = we.performed_equipment_id
          ),
          'sets', coalesce(prev_sets.sets, '[]'::jsonb)
        )
      end as history
    from public.workout_exercises we
    join public.workouts w on w.id = we.workout_id
    left join public.exercises e on e.id = we.exercise_id
    left join public.equipment eq on eq.id = we.performed_equipment_id
    left join public.training_weekly_day_blocks twdb on twdb.id = we.training_weekly_day_block_id
    left join lateral (
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
          'is_warmup', es.is_warmup
        )
        order by es.set_no asc nulls last, es.id asc
      ) as sets
      from public.exercise_sets es
      where es.workout_exercise_id = we.id
    ) curr_sets on true
    left join lateral (
      select
        we_prev.id as prev_workout_exercise_id,
        w_prev.performed_on as prev_performed_on,
        we_prev.performed_equipment_id as prev_equipment_id,
        eq_prev.name as prev_equipment_name
      from public.workout_exercises we_prev
      join public.workouts w_prev on w_prev.id = we_prev.workout_id
      left join public.equipment eq_prev on eq_prev.id = we_prev.performed_equipment_id
      where w_prev.user_id = w.user_id
        and we_prev.exercise_id = we.exercise_id
        and w_prev.id <> w.id
      order by
        case
          when we.performed_equipment_id is not null
           and we_prev.performed_equipment_id = we.performed_equipment_id then 0
          else 1
        end,
        w_prev.performed_on desc,
        we_prev.id desc
      limit 1
    ) prev on true
    left join lateral (
      select jsonb_agg(
        jsonb_build_object(
          'id', es_prev.id,
          'set_no', es_prev.set_no,
          'reps', es_prev.reps,
          'weight', es_prev.weight,
          'rir', es_prev.rir,
          'target_reps_min', es_prev.target_reps_min,
          'target_reps_max', es_prev.target_reps_max,
          'target_weight', es_prev.target_weight,
          'is_warmup', es_prev.is_warmup
        )
        order by es_prev.set_no asc nulls last, es_prev.id asc
      ) as sets
      from public.exercise_sets es_prev
      where es_prev.workout_exercise_id = prev.prev_workout_exercise_id
    ) prev_sets on true
    where we.workout_id = p_workout_id
  )
  select jsonb_build_object(
    'workout', (
      select jsonb_build_object(
        'id', wb.id,
        'user_id', wb.user_id,
        'performed_on', wb.performed_on,
        'training_microcycle_id', wb.training_microcycle_id,
        'training_microcycle_name', wb.training_microcycle_name,
        'training_weekly_routine_id', wb.training_weekly_routine_id,
        'training_weekly_routine_name', wb.training_weekly_routine_name,
        'training_weekly_day_id', wb.training_weekly_day_id,
        'training_weekly_day_index', wb.training_weekly_day_index,
        'training_weekly_day_name', wb.training_weekly_day_name
      )
      from workout_base wb
    ),
    'exercises', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', er.workout_exercise_id,
            'sequence', er.sequence,
            'exercise_id', er.exercise_id,
            'exercise_name', er.exercise_name,
            'exercise_technique', er.exercise_technique,
            'performed_equipment_id', er.performed_equipment_id,
            'performed_equipment_name', er.performed_equipment_name,
            'training_weekly_day_block_id', er.training_weekly_day_block_id,
            'block_order', er.block_order,
            'block_type', er.block_type,
            'block_name', er.block_name,
            'training_block_exercise_id', er.training_block_exercise_id,
            'prescribed_sets', er.prescribed_sets,
            'prescribed_reps_min', er.prescribed_reps_min,
            'prescribed_reps_max', er.prescribed_reps_max,
            'prescribed_increment_kg', er.prescribed_increment_kg,
            'prescribed_backoff_percentage', er.prescribed_backoff_percentage,
            'sets', er.set_rows,
            'history', er.history
          )
          order by er.sequence asc nulls last, er.workout_exercise_id asc
        )
        from exercise_rows er
      ),
      '[]'::jsonb
    )
  )
  into v_payload;

  return coalesce(
    v_payload,
    jsonb_build_object(
      'workout', null,
      'exercises', '[]'::jsonb
    )
  );
end;
$$;

-- 11) Grants
grant execute on function public.training_can_manage_user(uuid) to anon, authenticated, service_role;
grant execute on function public.training_create_mesocycle_blueprint_v2(text,bigint,date,date,jsonb,uuid,text,jsonb) to anon, authenticated, service_role;
grant execute on function public.training_replace_block_exercises(bigint,jsonb) to anon, authenticated, service_role;
grant execute on function public.training_replace_microcycle_focuses(bigint,jsonb) to anon, authenticated, service_role;
grant execute on function public.training_get_next_session_day(uuid,date) to anon, authenticated, service_role;
grant execute on function public.training_create_workout_from_day(bigint,date,uuid,boolean) to anon, authenticated, service_role;
grant execute on function public.training_create_next_workout(uuid,date,boolean) to anon, authenticated, service_role;
grant execute on function public.training_get_workout_session_payload(bigint,uuid) to anon, authenticated, service_role;
