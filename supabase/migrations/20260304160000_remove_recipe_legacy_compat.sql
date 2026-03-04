begin;

-- Final recipe migration:
-- - normalize statuses
-- - harden security-definer RPC permissions/ownership checks
-- - remove accidental legacy function overloads

-- Normalize legacy free recipe statuses before constraining values.
update public.free_recipes
set status = lower(trim(status));

update public.free_recipes
set status = 'approved_private'
where status = 'approved';

do $$
declare
  invalid_statuses text;
begin
  select string_agg(distinct status, ', ' order by status)
  into invalid_statuses
  from public.free_recipes
  where status not in (
    'pending',
    'approved_private',
    'approved_general',
    'kept_as_free_recipe',
    'rejected'
  );

  if invalid_statuses is not null then
    raise exception 'Invalid free_recipes.status values found: %', invalid_statuses;
  end if;
end;
$$;

alter table public.free_recipes
  drop constraint if exists free_recipes_status_check;

alter table public.free_recipes
  add constraint free_recipes_status_check
  check (
    status in (
      'pending',
      'approved_private',
      'approved_general',
      'kept_as_free_recipe',
      'rejected'
    )
  );

-- Normalize legacy free recipe ingredient statuses.
update public.free_recipe_ingredients
set status = lower(trim(status));

update public.free_recipe_ingredients
set status = 'linked'
where status = 'approved';

do $$
declare
  invalid_statuses text;
begin
  select string_agg(distinct status, ', ' order by status)
  into invalid_statuses
  from public.free_recipe_ingredients
  where status not in ('linked', 'pending', 'rejected');

  if invalid_statuses is not null then
    raise exception 'Invalid free_recipe_ingredients.status values found: %', invalid_statuses;
  end if;
end;
$$;

alter table public.free_recipe_ingredients
  drop constraint if exists free_recipe_ingredients_status_check;

alter table public.free_recipe_ingredients
  add constraint free_recipe_ingredients_status_check
  check (status in ('linked', 'pending', 'rejected'));

-- Remove accidental overload that writes private ingredient grams.
drop function if exists public.get_users_with_free_recipes_by_status(jsonb);

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
  select fr.user_id
  into v_owner_user_id
  from public.free_recipes fr
  where fr.id = p_recipe_id;

  if not found then
    raise exception 'Free recipe not found';
  end if;

  v_is_admin := public.is_admin();
  v_is_coach := exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and r.role = 'coach'
  );

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

  update public.free_recipes
  set
    name = p_name,
    instructions = p_instructions,
    prep_time_min = p_prep_time_min,
    difficulty = p_difficulty
  where id = p_recipe_id;

  delete from public.free_recipe_ingredients
  where free_recipe_id = p_recipe_id;

  for ingredient_record in
    select *
    from jsonb_array_elements(coalesce(p_ingredients, '[]'::jsonb))
  loop
    insert into public.free_recipe_ingredients (free_recipe_id, food_id, grams, status)
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
  select pr.user_id
  into v_owner_user_id
  from public.private_recipes pr
  where pr.id = p_recipe_id;

  if not found then
    raise exception 'Private recipe not found';
  end if;

  v_is_admin := public.is_admin();
  v_is_coach := exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and r.role = 'coach'
  );

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

  update public.private_recipes
  set
    name = p_name,
    instructions = p_instructions,
    prep_time_min = p_prep_time_min,
    difficulty = p_difficulty
  where id = p_recipe_id;

  delete from public.private_recipe_ingredients
  where private_recipe_id = p_recipe_id;

  for ingredient_record in
    select *
    from jsonb_array_elements(coalesce(p_ingredients, '[]'::jsonb))
  loop
    insert into public.private_recipe_ingredients (private_recipe_id, food_id, grams)
    values (
      p_recipe_id,
      (ingredient_record->>'food_id')::bigint,
      (ingredient_record->>'grams')::numeric
    );
  end loop;
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
  select pr.user_id
  into v_owner_user_id
  from public.private_recipes pr
  where pr.id = p_recipe_id;

  if not found then
    raise exception 'Private recipe not found';
  end if;

  v_is_admin := public.is_admin();
  v_is_coach := exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and r.role = 'coach'
  );

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
    from public.private_recipes
    where parent_private_recipe_id = p_recipe_id
  loop
    perform public.delete_private_recipe_cascade(child_id);
  end loop;

  delete from public.diet_change_requests
  where private_recipe_id = p_recipe_id
     or requested_changes_private_recipe_id = p_recipe_id;

  delete from public.private_recipe_ingredients
  where private_recipe_id = p_recipe_id;

  delete from public.daily_meal_logs
  where private_recipe_id = p_recipe_id;

  delete from public.planned_meals
  where private_recipe_id = p_recipe_id;

  delete from public.daily_ingredient_adjustments
  where private_recipe_id = p_recipe_id;

  delete from public.daily_ingredient_adjustments
  where equivalence_adjustment_id in (
    select id
    from public.equivalence_adjustments
    where source_private_recipe_id = p_recipe_id
  );

  delete from public.equivalence_adjustments
  where source_private_recipe_id = p_recipe_id;

  delete from public.private_recipes
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
  v_is_coach := exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and r.role = 'coach'
  );

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

-- Harden SECURITY DEFINER execution grants (no unauthenticated access).
revoke all on function public.update_free_recipe(bigint, text, text, integer, text, jsonb) from public;
revoke all on function public.update_free_recipe(bigint, text, text, integer, text, jsonb) from anon;
revoke all on function public.update_free_recipe(bigint, text, text, integer, text, jsonb) from authenticated;
grant execute on function public.update_free_recipe(bigint, text, text, integer, text, jsonb) to authenticated;
grant execute on function public.update_free_recipe(bigint, text, text, integer, text, jsonb) to service_role;

revoke all on function public.update_private_recipe(bigint, text, text, integer, text, jsonb) from public;
revoke all on function public.update_private_recipe(bigint, text, text, integer, text, jsonb) from anon;
revoke all on function public.update_private_recipe(bigint, text, text, integer, text, jsonb) from authenticated;
grant execute on function public.update_private_recipe(bigint, text, text, integer, text, jsonb) to authenticated;
grant execute on function public.update_private_recipe(bigint, text, text, integer, text, jsonb) to service_role;

revoke all on function public.delete_private_recipe_cascade(bigint) from public;
revoke all on function public.delete_private_recipe_cascade(bigint) from anon;
revoke all on function public.delete_private_recipe_cascade(bigint) from authenticated;
grant execute on function public.delete_private_recipe_cascade(bigint) to authenticated;
grant execute on function public.delete_private_recipe_cascade(bigint) to service_role;

revoke all on function public.delete_diet_plan_recipe_with_dependencies(bigint) from public;
revoke all on function public.delete_diet_plan_recipe_with_dependencies(bigint) from anon;
revoke all on function public.delete_diet_plan_recipe_with_dependencies(bigint) from authenticated;
grant execute on function public.delete_diet_plan_recipe_with_dependencies(bigint) to authenticated;
grant execute on function public.delete_diet_plan_recipe_with_dependencies(bigint) to service_role;

revoke all on function public.get_users_with_free_recipes_by_status(text) from public;
revoke all on function public.get_users_with_free_recipes_by_status(text) from anon;
revoke all on function public.get_users_with_free_recipes_by_status(text) from authenticated;
grant execute on function public.get_users_with_free_recipes_by_status(text) to authenticated;
grant execute on function public.get_users_with_free_recipes_by_status(text) to service_role;

commit;
