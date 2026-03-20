-- Remove duplicated day types (upper/lower), enrich blocks with objective + key exercise,
-- and simplify mesocycle builder so day definition comes only from blocks.

-- 1) Normalize duplicated values
update public.routines
set day_type = 'torso'
where day_type = 'upper';

update public.routines
set day_type = 'pierna'
where day_type = 'lower';

update public.routine_day_blocks
set block_type = 'torso'
where block_type = 'upper';

update public.routine_day_blocks
set block_type = 'pierna'
where block_type = 'lower';

-- 2) Tighten constraints without upper/lower
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'routines_day_type_check'
      and conrelid = 'public.routines'::regclass
  ) then
    alter table public.routines drop constraint routines_day_type_check;
  end if;

  alter table public.routines
    add constraint routines_day_type_check
    check (
      day_type is null
      or day_type in (
        'torso','pierna','fullbody','push','pull','core','cardio','movilidad','custom'
      )
    );
end
$$;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'routine_day_blocks_block_type_check'
      and conrelid = 'public.routine_day_blocks'::regclass
  ) then
    alter table public.routine_day_blocks drop constraint routine_day_blocks_block_type_check;
  end if;

  alter table public.routine_day_blocks
    add constraint routine_day_blocks_block_type_check
    check (
      block_type in (
        'torso','pierna','fullbody','push','pull','core','cardio','movilidad','custom'
      )
    );
end
$$;

-- 3) Add block objective and key exercise fields
alter table public.routine_day_blocks
  add column if not exists goal_pattern_id bigint references public.training_movement_patterns(id),
  add column if not exists primary_exercise_id bigint references public.exercises(id);

create index if not exists routine_day_blocks_goal_pattern_idx
  on public.routine_day_blocks (goal_pattern_id);

create index if not exists routine_day_blocks_primary_exercise_idx
  on public.routine_day_blocks (primary_exercise_id);

-- 4) Rebuild creator function: day structure is defined by blocks only.
create or replace function public.create_mesocycle_blueprint(
  p_name text,
  p_start_date date,
  p_end_date date,
  p_objective_id bigint,
  p_days jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mesocycle_id bigint;
  v_objective_name text;
  v_day jsonb;
  v_day_idx integer := 0;
  v_routine_id bigint;
  v_day_name text;
  v_day_type text;
  v_focuses text[];
  v_focuses_acc text[] := '{}';
  v_block jsonb;
  v_block_idx integer;
  v_block_type text;
  v_block_label text;
  v_goal_pattern_id bigint;
  v_primary_exercise_id bigint;
begin
  if auth.uid() is null then
    raise exception 'auth required';
  end if;

  if p_days is null or jsonb_typeof(p_days) <> 'array' or jsonb_array_length(p_days) = 0 then
    raise exception 'p_days must be a non-empty json array';
  end if;

  if jsonb_array_length(p_days) > 7 then
    raise exception 'p_days cannot exceed 7 entries';
  end if;

  if p_start_date is not null and p_end_date is not null and p_end_date < p_start_date then
    raise exception 'end_date cannot be before start_date';
  end if;

  select name
  into v_objective_name
  from public.training_objectives
  where id = p_objective_id
    and is_active;

  if v_objective_name is null then
    raise exception 'invalid p_objective_id %', p_objective_id;
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
    auth.uid(),
    nullif(trim(coalesce(p_name, '')), ''),
    v_objective_name,
    p_objective_id,
    p_start_date,
    p_end_date,
    jsonb_array_length(p_days)
  )
  returning id into v_mesocycle_id;

  for v_day in
    select value from jsonb_array_elements(p_days)
  loop
    v_day_idx := v_day_idx + 1;
    v_day_name := nullif(trim(coalesce(v_day->>'name', '')), '');
    v_focuses_acc := '{}';
    v_day_type := null;

    -- Pre-create routine so blocks can reference it.
    insert into public.routines (
      user_id,
      mesocycle_id,
      day_index,
      day_type,
      name,
      focus
    )
    values (
      auth.uid(),
      v_mesocycle_id,
      v_day_idx,
      'custom',
      coalesce(v_day_name, 'Dia ' || v_day_idx::text),
      null
    )
    returning id into v_routine_id;

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
          or v_block_type not in ('torso','pierna','fullbody','push','pull','core','cardio','movilidad','custom') then
          v_block_type := 'custom';
        end if;

        if v_day_type is null then
          v_day_type := v_block_type;
        end if;

        if not (v_focuses_acc @> array[v_block_type]) then
          v_focuses_acc := v_focuses_acc || v_block_type;
        end if;

        v_block_label := nullif(trim(coalesce(v_block->>'label', '')), '');
        v_goal_pattern_id := nullif(trim(coalesce(v_block->>'goal_pattern_id', '')), '')::bigint;
        v_primary_exercise_id := nullif(trim(coalesce(v_block->>'primary_exercise_id', '')), '')::bigint;

        insert into public.routine_day_blocks (
          routine_id,
          block_order,
          block_type,
          block_label,
          goal_pattern_id,
          primary_exercise_id
        )
        values (
          v_routine_id,
          v_block_idx,
          v_block_type,
          v_block_label,
          v_goal_pattern_id,
          v_primary_exercise_id
        );
      end loop;
    else
      v_day_type := 'custom';
      v_focuses_acc := array['custom'];
      insert into public.routine_day_blocks (routine_id, block_order, block_type)
      values (v_routine_id, 1, 'custom');
    end if;

    v_focuses := (
      select array_agg(distinct focus_item)
      from unnest(v_focuses_acc) as focus_item
    );

    update public.routines
    set day_type = coalesce(v_day_type, 'custom'),
        focus = array_to_string(v_focuses, ', '),
        name = coalesce(v_day_name, initcap(coalesce(v_day_type, 'custom')) || ' D' || v_day_idx::text)
    where id = v_routine_id;
  end loop;

  return v_mesocycle_id;
end;
$$;

grant execute on function public.create_mesocycle_blueprint(text,date,date,bigint,jsonb) to anon, authenticated, service_role;
