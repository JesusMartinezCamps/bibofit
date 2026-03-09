begin;

-- =============================================================================
-- 1) Role helpers (domain-aware + backward-compatible)
-- =============================================================================

create or replace function public.is_coach_role(p_role text)
returns boolean
language sql
immutable
as $$
  select lower(coalesce(p_role, '')) in ('coach-nutrition', 'coach-workout', 'coach');
$$;

create or replace function public.is_client_role(p_role text)
returns boolean
language sql
immutable
as $$
  select lower(coalesce(p_role, '')) in ('pro-nutrition', 'pro-workout', 'client');
$$;

create or replace function public.user_has_role(p_user_id uuid, p_roles text[])
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  return exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = p_user_id
      and lower(r.role) = any(p_roles)
  );
end;
$$;

-- =============================================================================
-- 2) Roles migration: client/coach -> pro-nutrition/coach-nutrition (+workout)
-- =============================================================================

do $$
declare
  v_client_id integer;
  v_pro_nutrition_id integer;
  v_coach_id integer;
  v_coach_nutrition_id integer;
begin
  -- client -> pro-nutrition
  select id into v_client_id from public.roles where role = 'client' limit 1;
  select id into v_pro_nutrition_id from public.roles where role = 'pro-nutrition' limit 1;

  if v_client_id is not null and v_pro_nutrition_id is null then
    update public.roles
    set role = 'pro-nutrition',
        description = coalesce(nullif(description, ''), 'Cliente pro de nutricion')
    where id = v_client_id;
  elsif v_client_id is not null and v_pro_nutrition_id is not null and v_client_id <> v_pro_nutrition_id then
    update public.user_roles set role_id = v_pro_nutrition_id where role_id = v_client_id;

    insert into public.commercial_plan_role_targets (plan_id, role_id)
    select plan_id, v_pro_nutrition_id
    from public.commercial_plan_role_targets
    where role_id = v_client_id
    on conflict (plan_id, role_id) do nothing;

    delete from public.commercial_plan_role_targets where role_id = v_client_id;

    update public.invitation_links
    set role_id = v_pro_nutrition_id
    where role_id = v_client_id;

    update public.invitation_link_usages
    set assigned_role_id = v_pro_nutrition_id
    where assigned_role_id = v_client_id;

    delete from public.roles where id = v_client_id;
  end if;

  -- coach -> coach-nutrition
  select id into v_coach_id from public.roles where role = 'coach' limit 1;
  select id into v_coach_nutrition_id from public.roles where role = 'coach-nutrition' limit 1;

  if v_coach_id is not null and v_coach_nutrition_id is null then
    update public.roles
    set role = 'coach-nutrition',
        description = coalesce(nullif(description, ''), 'Coach de nutricion')
    where id = v_coach_id;
  elsif v_coach_id is not null and v_coach_nutrition_id is not null and v_coach_id <> v_coach_nutrition_id then
    update public.user_roles set role_id = v_coach_nutrition_id where role_id = v_coach_id;

    insert into public.commercial_plan_role_targets (plan_id, role_id)
    select plan_id, v_coach_nutrition_id
    from public.commercial_plan_role_targets
    where role_id = v_coach_id
    on conflict (plan_id, role_id) do nothing;

    delete from public.commercial_plan_role_targets where role_id = v_coach_id;

    update public.invitation_links
    set role_id = v_coach_nutrition_id
    where role_id = v_coach_id;

    update public.invitation_link_usages
    set assigned_role_id = v_coach_nutrition_id
    where assigned_role_id = v_coach_id;

    delete from public.roles where id = v_coach_id;
  end if;
end;
$$;

insert into public.roles (role, description)
values
  ('pro-workout', 'Cliente pro de entreno'),
  ('coach-workout', 'Coach de entreno')
on conflict (role) do update
set description = excluded.description;

-- Optional profile_type alignment for legacy values
update public.profiles
set profile_type = 'pro-nutrition'
where lower(coalesce(profile_type, '')) = 'client';

update public.profiles
set profile_type = 'coach-nutrition'
where lower(coalesce(profile_type, '')) = 'coach';

-- =============================================================================
-- 3) Core authorization functions
-- =============================================================================

create or replace function public.is_admin_or_coach()
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  return exists (
    select 1
    from public.user_roles ur
    join public.roles r on ur.role_id = r.id
    where ur.user_id = auth.uid()
      and (
        lower(r.role) = 'admin'
        or public.is_coach_role(r.role)
      )
  );
end;
$$;

create or replace function public.sync_user_role_from_subscription(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_nutrition_role_id integer;
  v_workout_role_id integer;
  v_free_role_id integer;
  v_has_active_nutrition_access boolean;
  v_has_active_workout_access boolean;
begin
  select id into v_nutrition_role_id from public.roles where role = 'pro-nutrition' limit 1;
  if v_nutrition_role_id is null then
    select id into v_nutrition_role_id from public.roles where role = 'client' limit 1;
  end if;

  select id into v_workout_role_id from public.roles where role = 'pro-workout' limit 1;
  select id into v_free_role_id from public.roles where role = 'free' limit 1;

  if v_nutrition_role_id is null or v_free_role_id is null then
    raise exception 'Required roles (pro-nutrition/free) are missing in public.roles';
  end if;

  select exists (
    select 1
    from public.user_subscriptions us
    join public.commercial_plan_role_targets rt on rt.plan_id = us.plan_id
    join public.roles r on r.id = rt.role_id
    where us.user_id = p_user_id
      and us.status = 'active'
      and (us.ends_at is null or us.ends_at > now())
      and lower(r.role) in ('pro-nutrition', 'client')
  ) into v_has_active_nutrition_access;

  select exists (
    select 1
    from public.user_subscriptions us
    join public.commercial_plan_role_targets rt on rt.plan_id = us.plan_id
    join public.roles r on r.id = rt.role_id
    where us.user_id = p_user_id
      and us.status = 'active'
      and (us.ends_at is null or us.ends_at > now())
      and lower(r.role) = 'pro-workout'
  ) into v_has_active_workout_access;

  -- Current schema allows a single role per user (user_roles PK=user_id).
  -- Priority: nutrition > workout > free.
  if v_has_active_nutrition_access then
    insert into public.user_roles (user_id, role_id)
    values (p_user_id, v_nutrition_role_id)
    on conflict (user_id) do update
      set role_id = excluded.role_id;
  elsif v_has_active_workout_access and v_workout_role_id is not null then
    insert into public.user_roles (user_id, role_id)
    values (p_user_id, v_workout_role_id)
    on conflict (user_id) do update
      set role_id = excluded.role_id;
  else
    insert into public.user_roles (user_id, role_id)
    values (p_user_id, v_free_role_id)
    on conflict (user_id) do update
      set role_id = excluded.role_id;
  end if;
end;
$$;

-- =============================================================================
-- 4) Pricing model: explicit product area for future workout/bundles
-- =============================================================================

alter table public.commercial_plans
  add column if not exists product_area text;

update public.commercial_plans
set product_area = 'nutrition'
where product_area is null;

alter table public.commercial_plans
  alter column product_area set default 'nutrition';

alter table public.commercial_plans
  alter column product_area set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'commercial_plans_product_area_check'
  ) then
    alter table public.commercial_plans
      add constraint commercial_plans_product_area_check
      check (product_area in ('nutrition', 'workout', 'bundle'));
  end if;
end;
$$;

create index if not exists idx_commercial_plans_product_area_active_sort
  on public.commercial_plans (product_area, is_active, sort_order, id);

-- =============================================================================
-- 5) Invitation roles validation
-- =============================================================================

create or replace function public.admin_create_invitation_link(
  p_destination text default 'login',
  p_role_id integer default null,
  p_center_id bigint default null,
  p_max_uses integer default 1,
  p_note text default null,
  p_expires_at timestamptz default null
)
returns public.invitation_links
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_token text;
  v_invitation public.invitation_links;
  v_role_name text;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Only admins can create invitation links.';
  end if;

  if coalesce(trim(p_destination), '') <> 'login' then
    raise exception 'Unsupported destination: %', p_destination;
  end if;

  if p_role_id is null then
    raise exception 'Role is required.';
  end if;

  select r.role
  into v_role_name
  from public.roles r
  where r.id = p_role_id;

  if v_role_name is null then
    raise exception 'Role not found: %', p_role_id;
  end if;

  if lower(v_role_name) not in (
    'free',
    'pro-nutrition',
    'pro-workout',
    'coach-nutrition',
    'coach-workout',
    'client',
    'coach'
  ) then
    raise exception 'Invitations can only assign free/pro/coach roles.';
  end if;

  if p_center_id is not null and not exists (
    select 1
    from public.centers c
    where c.id = p_center_id
  ) then
    raise exception 'Center not found: %', p_center_id;
  end if;

  if p_max_uses is not null and p_max_uses <= 0 then
    raise exception 'max_uses must be greater than 0 when present.';
  end if;

  if p_expires_at is not null and p_expires_at <= v_now then
    raise exception 'Expiration must be in the future.';
  end if;

  loop
    v_token := lower(replace(gen_random_uuid()::text, '-', ''))
      || substr(lower(replace(gen_random_uuid()::text, '-', '')), 1, 8);

    exit when not exists (
      select 1
      from public.invitation_links il
      where il.token = v_token
    );
  end loop;

  insert into public.invitation_links (
    token,
    destination,
    role_id,
    center_id,
    max_uses,
    note,
    expires_at,
    created_by
  )
  values (
    v_token,
    'login',
    p_role_id,
    p_center_id,
    p_max_uses,
    nullif(trim(p_note), ''),
    p_expires_at,
    auth.uid()
  )
  returning * into v_invitation;

  return v_invitation;
end;
$$;

-- =============================================================================
-- 6) Functions with coach checks (domain-aware)
-- =============================================================================

create or replace function public.convert_free_to_private_recipe(
  p_free_recipe_id bigint,
  p_new_recipe_data jsonb,
  p_new_ingredients jsonb
)
returns bigint
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_user_id uuid;
  v_diet_plan_id bigint;
  v_day_meal_id bigint;
  new_user_recipe_id bigint;
  occurrence_record record;
  ingredient_record jsonb;
  is_coach boolean;
  is_admin_user boolean;
begin
  is_admin_user := is_admin();
  is_coach := public.user_has_role(auth.uid(), array['coach-nutrition', 'coach-workout', 'coach']);

  select user_id, diet_plan_id, day_meal_id
  into v_user_id, v_diet_plan_id, v_day_meal_id
  from user_recipes
  where id = p_free_recipe_id;

  if v_user_id is null then
    raise exception 'Free recipe not found';
  end if;

  if not is_admin_user then
    if is_coach then
      if not exists (select 1 from coach_clients where coach_id = auth.uid() and client_id = v_user_id) then
        raise exception 'Permission denied: Client is not assigned to you.';
      end if;
    else
      raise exception 'Only admins or assigned coaches can perform this action';
    end if;
  end if;

  insert into user_recipes (
    user_id, type, name, instructions, prep_time_min, difficulty,
    diet_plan_id, day_meal_id, source_user_recipe_id
  )
  values (
    v_user_id,
    'private',
    p_new_recipe_data->>'name',
    p_new_recipe_data->>'instructions',
    (p_new_recipe_data->>'prep_time_min')::integer,
    p_new_recipe_data->>'difficulty',
    v_diet_plan_id,
    v_day_meal_id,
    p_free_recipe_id
  )
  returning id into new_user_recipe_id;

  for ingredient_record in select * from jsonb_array_elements(p_new_ingredients)
  loop
    insert into recipe_ingredients (user_recipe_id, food_id, grams)
    values (
      new_user_recipe_id,
      (ingredient_record->>'food_id')::bigint,
      (ingredient_record->>'grams')::numeric
    );
  end loop;

  for occurrence_record in
    select id from free_recipe_occurrences where user_recipe_id = p_free_recipe_id
  loop
    update daily_meal_logs
    set
      user_recipe_id = new_user_recipe_id,
      free_recipe_occurrence_id = null
    where free_recipe_occurrence_id = occurrence_record.id;
  end loop;

  update equivalence_adjustments
  set source_user_recipe_id = new_user_recipe_id
  where source_user_recipe_id = p_free_recipe_id;

  delete from free_recipe_occurrences where user_recipe_id = p_free_recipe_id;
  delete from recipe_ingredients where user_recipe_id = p_free_recipe_id;
  delete from user_recipes where id = p_free_recipe_id;

  return new_user_recipe_id;
end;
$$;

create or replace function public.delete_free_recipe_and_occurrences(p_free_recipe_id bigint)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_user_id uuid;
  is_coach boolean;
  is_admin_user boolean;
begin
  select user_id into v_user_id from user_recipes where id = p_free_recipe_id;

  if v_user_id is null then
    raise exception 'Free recipe not found';
  end if;

  is_admin_user := is_admin();
  is_coach := public.user_has_role(auth.uid(), array['coach-nutrition', 'coach-workout', 'coach']);

  if auth.uid() != v_user_id and not is_admin_user then
    if is_coach then
      if not exists (select 1 from coach_clients where coach_id = auth.uid() and client_id = v_user_id) then
        raise exception 'Permission denied to delete this free recipe. Client not assigned.';
      end if;
    else
      raise exception 'Permission denied to delete this free recipe.';
    end if;
  end if;

  delete from equivalence_adjustments
  where source_user_recipe_id = p_free_recipe_id;

  delete from daily_meal_logs
  where free_recipe_occurrence_id in (
    select id from free_recipe_occurrences where user_recipe_id = p_free_recipe_id
  );

  delete from free_recipe_occurrences where user_recipe_id = p_free_recipe_id;
  delete from recipe_ingredients where user_recipe_id = p_free_recipe_id;
  delete from user_recipes where id = p_free_recipe_id;
end;
$$;

create or replace function public.delete_private_recipe_cascade(p_recipe_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  child_id bigint;
  v_owner_user_id uuid;
  v_is_admin boolean;
  v_is_coach boolean;
begin
  select ur.user_id
  into v_owner_user_id
  from public.user_recipes ur
  where ur.id = p_recipe_id and ur.type = 'private';

  if not found then
    raise exception 'Private recipe not found';
  end if;

  v_is_admin := public.is_admin();
  v_is_coach := public.user_has_role(auth.uid(), array['coach-nutrition', 'coach-workout', 'coach']);

  if auth.uid() is distinct from v_owner_user_id and not v_is_admin then
    if not v_is_coach or not exists (
      select 1
      from public.coach_clients cc
      where cc.coach_id = auth.uid()
        and cc.client_id = v_owner_user_id
    ) then
      raise exception 'Permission denied to delete this private recipe.';
    end if;
  end if;

  for child_id in
    select id
    from public.user_recipes
    where parent_user_recipe_id = p_recipe_id
      and type = 'private'
  loop
    perform public.delete_private_recipe_cascade(child_id);
  end loop;

  delete from public.diet_change_requests
  where user_recipe_id = p_recipe_id
     or requested_changes_user_recipe_id = p_recipe_id;

  delete from public.recipe_ingredients
  where user_recipe_id = p_recipe_id;

  delete from public.daily_meal_logs
  where user_recipe_id = p_recipe_id;

  delete from public.planned_meals
  where user_recipe_id = p_recipe_id;

  delete from public.daily_ingredient_adjustments
  where user_recipe_id = p_recipe_id;

  delete from public.daily_ingredient_adjustments
  where equivalence_adjustment_id in (
    select id
    from public.equivalence_adjustments
    where source_user_recipe_id = p_recipe_id
  );

  delete from public.equivalence_adjustments
  where source_user_recipe_id = p_recipe_id;

  delete from public.user_recipes
  where id = p_recipe_id;
end;
$$;

create or replace function public.delete_diet_plan_recipe_with_dependencies(p_recipe_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  child_id bigint;
  v_owner_user_id uuid;
  v_is_admin boolean;
  v_is_coach boolean;
begin
  select dp.user_id
  into v_owner_user_id
  from public.diet_plan_recipes dpr
  join public.diet_plans dp on dp.id = dpr.diet_plan_id
  where dpr.id = p_recipe_id;

  if not found then
    raise exception 'Diet plan recipe not found';
  end if;

  v_is_admin := public.is_admin();
  v_is_coach := public.user_has_role(auth.uid(), array['coach-nutrition', 'coach-workout', 'coach']);

  if not v_is_admin then
    if v_owner_user_id is null then
      raise exception 'Only admins can delete template plan recipes.';
    end if;

    if auth.uid() is distinct from v_owner_user_id then
      if not v_is_coach or not exists (
        select 1
        from public.coach_clients cc
        where cc.coach_id = auth.uid()
          and cc.client_id = v_owner_user_id
      ) then
        raise exception 'Permission denied to delete this diet plan recipe.';
      end if;
    end if;
  end if;

  for child_id in
    select id
    from public.diet_plan_recipes
    where parent_diet_plan_recipe_id = p_recipe_id
  loop
    perform public.delete_diet_plan_recipe_with_dependencies(child_id);
  end loop;

  delete from public.diet_change_requests
  where diet_plan_recipe_id = p_recipe_id;

  delete from public.daily_meal_logs
  where diet_plan_recipe_id = p_recipe_id;

  delete from public.planned_meals
  where diet_plan_recipe_id = p_recipe_id;

  delete from public.daily_ingredient_adjustments
  where diet_plan_recipe_id = p_recipe_id;

  delete from public.recipe_macros
  where diet_plan_recipe_id = p_recipe_id;

  delete from public.diet_plan_recipe_ingredients
  where diet_plan_recipe_id = p_recipe_id;

  delete from public.equivalence_adjustments
  where source_diet_plan_recipe_id = p_recipe_id;

  delete from public.diet_plan_recipes
  where id = p_recipe_id;
end;
$$;

create or replace function public.update_free_recipe(
  p_recipe_id bigint,
  p_name text,
  p_instructions text,
  p_prep_time_min integer,
  p_difficulty text,
  p_ingredients jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ingredient_record jsonb;
  v_owner_user_id uuid;
  v_is_admin boolean;
  v_is_coach boolean;
begin
  select ur.user_id
  into v_owner_user_id
  from public.user_recipes ur
  where ur.id = p_recipe_id and ur.type = 'free';

  if not found then
    raise exception 'Free recipe not found';
  end if;

  v_is_admin := public.is_admin();
  v_is_coach := public.user_has_role(auth.uid(), array['coach-nutrition', 'coach-workout', 'coach']);

  if auth.uid() is distinct from v_owner_user_id and not v_is_admin then
    if not v_is_coach or not exists (
      select 1
      from public.coach_clients cc
      where cc.coach_id = auth.uid()
        and cc.client_id = v_owner_user_id
    ) then
      raise exception 'Permission denied to update this free recipe.';
    end if;
  end if;

  update public.user_recipes
  set
    name = p_name,
    instructions = p_instructions,
    prep_time_min = p_prep_time_min,
    difficulty = p_difficulty
  where id = p_recipe_id;

  delete from public.recipe_ingredients
  where user_recipe_id = p_recipe_id;

  for ingredient_record in
    select *
    from jsonb_array_elements(coalesce(p_ingredients, '[]'::jsonb))
  loop
    insert into public.recipe_ingredients (user_recipe_id, food_id, grams, status)
    values (
      p_recipe_id,
      (ingredient_record->>'food_id')::bigint,
      (ingredient_record->>'grams')::numeric,
      case
        when lower(coalesce(ingredient_record->>'status', '')) = 'pending' then 'pending'
        when lower(coalesce(ingredient_record->>'status', '')) = 'rejected' then 'rejected'
        else 'linked'
      end
    );
  end loop;
end;
$$;

create or replace function public.update_private_recipe(
  p_recipe_id bigint,
  p_name text,
  p_instructions text,
  p_prep_time_min integer,
  p_difficulty text,
  p_ingredients jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ingredient_record jsonb;
  v_owner_user_id uuid;
  v_is_admin boolean;
  v_is_coach boolean;
begin
  select ur.user_id
  into v_owner_user_id
  from public.user_recipes ur
  where ur.id = p_recipe_id and ur.type = 'private';

  if not found then
    raise exception 'Private recipe not found';
  end if;

  v_is_admin := public.is_admin();
  v_is_coach := public.user_has_role(auth.uid(), array['coach-nutrition', 'coach-workout', 'coach']);

  if auth.uid() is distinct from v_owner_user_id and not v_is_admin then
    if not v_is_coach or not exists (
      select 1
      from public.coach_clients cc
      where cc.coach_id = auth.uid()
        and cc.client_id = v_owner_user_id
    ) then
      raise exception 'Permission denied to update this private recipe.';
    end if;
  end if;

  update public.user_recipes
  set
    name = p_name,
    instructions = p_instructions,
    prep_time_min = p_prep_time_min,
    difficulty = p_difficulty
  where id = p_recipe_id;

  delete from public.recipe_ingredients
  where user_recipe_id = p_recipe_id;

  for ingredient_record in
    select *
    from jsonb_array_elements(coalesce(p_ingredients, '[]'::jsonb))
  loop
    insert into public.recipe_ingredients (user_recipe_id, food_id, grams)
    values (
      p_recipe_id,
      (ingredient_record->>'food_id')::bigint,
      (ingredient_record->>'grams')::numeric
    );
  end loop;
end;
$$;

commit;
