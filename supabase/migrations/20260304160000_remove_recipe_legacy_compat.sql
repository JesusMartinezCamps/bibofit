begin;
-- Keep canonical recipe entities model (recipes/private_recipes/free_recipes)
-- and remove only legacy compatibility artifacts.

update public.free_recipes
set status = lower(trim(status));
update public.free_recipe_ingredients
set status = lower(trim(status));
update public.free_recipes
set status = 'approved_private'
where status = 'approved';
update public.free_recipe_ingredients
set status = 'linked'
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
alter table public.free_recipe_ingredients
  drop constraint if exists free_recipe_ingredients_status_check;
alter table public.free_recipe_ingredients
  add constraint free_recipe_ingredients_status_check
  check (status in ('linked', 'pending', 'rejected'));
drop function if exists public.get_users_with_free_recipes_by_status(jsonb);
create or replace function public.get_users_with_free_recipes_by_status(p_status text)
returns table(user_id uuid, full_name text, pending_count integer)
language plpgsql
set search_path = public
as $$
begin
  return query
  select
    p.user_id,
    p.full_name,
    count(fr.id)::integer as pending_count
  from public.free_recipes fr
  join public.profiles p on p.user_id = fr.user_id
  where fr.status = p_status
  group by p.user_id, p.full_name
  having count(fr.id) > 0
  order by p.full_name;
end;
$$;
-- Ensure SECURITY DEFINER recipe RPCs are never callable by anon/public.
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
