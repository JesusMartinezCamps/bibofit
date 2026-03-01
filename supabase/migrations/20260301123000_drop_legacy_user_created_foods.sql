begin;

-- Keep food catalog write access for end users now that food is canonical.
drop policy if exists "Allow users to insert own foods" on public.food;
drop policy if exists "Allow users to update own foods" on public.food;
drop policy if exists "Allow users to delete own foods" on public.food;

create policy "Allow users to insert own foods"
  on public.food
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Allow users to update own foods"
  on public.food
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Allow users to delete own foods"
  on public.food
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- Remove legacy user-created food schema.
drop table if exists public.user_created_food_vitamins cascade;
drop table if exists public.user_created_food_minerals cascade;
drop table if exists public.user_created_food_sensitivities cascade;
drop table if exists public.user_created_food_to_food_groups cascade;
drop table if exists public.user_created_foods cascade;
drop sequence if exists public.user_created_foods_id_seq;

-- Canonical delete RPC no longer references dropped legacy tables.
create or replace function public.delete_food_with_dependencies(p_food_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'Only admins can delete food items.';
  end if;

  delete from food_to_food_groups where food_id = p_food_id;
  delete from food_to_macro_roles where food_id = p_food_id;
  delete from food_to_seasons where food_id = p_food_id;
  delete from food_to_stores where food_id = p_food_id;
  delete from food_sensitivities where food_id = p_food_id;
  delete from food_medical_conditions where food_id = p_food_id;
  delete from food_antioxidants where food_id = p_food_id;
  delete from food_vitamins where food_id = p_food_id;
  delete from food_minerals where food_id = p_food_id;
  delete from food_aminograms where food_id = p_food_id;
  delete from food_aminogram_properties where food_id = p_food_id;
  delete from food_fats where food_id = p_food_id;
  delete from food_to_carb_subtypes where food_id = p_food_id;
  delete from food_carbs where food_id = p_food_id;
  delete from food_fat_classification where food_id = p_food_id;
  delete from food_carb_classification where food_id = p_food_id;
  delete from recipe_ingredients where food_id = p_food_id;
  delete from diet_plan_recipe_ingredients where food_id = p_food_id;
  delete from daily_ingredient_adjustments where food_id = p_food_id;
  delete from shopping_list_items where food_id = p_food_id;
  delete from snack_ingredients where food_id = p_food_id;
  delete from free_recipe_ingredients where food_id = p_food_id;
  delete from private_recipe_ingredients where food_id = p_food_id;
  delete from user_individual_food_restrictions where food_id = p_food_id;
  delete from preferred_foods where food_id = p_food_id;
  delete from non_preferred_foods where food_id = p_food_id;

  delete from food where id = p_food_id;
end;
$$;

-- Pending-food queue now lives in public.food.
create or replace function public.get_users_with_pending_foods_count()
returns table(user_id uuid, full_name text, pending_count integer)
language plpgsql
set search_path = public
as $$
begin
  return query
  select
    p.user_id,
    p.full_name,
    count(f.id)::integer as pending_count
  from public.food f
  join public.profiles p on f.user_id = p.user_id
  where f.status = 'pending'
    and f.user_id is not null
  group by p.user_id, p.full_name
  having count(f.id) > 0
  order by p.full_name;
end;
$$;

-- Free-recipe updates now write only canonical food_id.
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
begin
  update free_recipes
  set
    name = p_name,
    instructions = p_instructions,
    prep_time_min = p_prep_time_min,
    difficulty = p_difficulty
  where id = p_recipe_id;

  delete from free_recipe_ingredients
  where free_recipe_id = p_recipe_id;

  for ingredient_record in select * from jsonb_array_elements(p_ingredients)
  loop
    insert into free_recipe_ingredients (free_recipe_id, food_id, grams, status)
    values (
      p_recipe_id,
      (ingredient_record->>'food_id')::bigint,
      (ingredient_record->>'grams')::numeric,
      'approved'
    );
  end loop;
end;
$$;

-- Plan payload no longer emits removed user_created_food_id.
create or replace function public.get_plan_items(
  p_user_id uuid,
  p_plan_id bigint,
  p_start_date date,
  p_end_date date
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'planRecipes', (
      select coalesce(jsonb_agg(dpr_agg), '[]'::jsonb)
      from (
        select
          dpr.*,
          r.name as recipe_name,
          r.instructions as recipe_instructions,
          r.prep_time_min as recipe_prep_time_min,
          r.difficulty as recipe_difficulty,
          (
            select jsonb_agg(jsonb_build_object('food_id', ri.food_id, 'grams', ri.grams))
            from recipe_ingredients ri where ri.recipe_id = dpr.recipe_id
          ) as recipe_ingredients,
          dm.name as day_meal_name
        from diet_plan_recipes dpr
        join recipes r on dpr.recipe_id = r.id
        join day_meals dm on dpr.day_meal_id = dm.id
        where dpr.diet_plan_id = p_plan_id
      ) dpr_agg
    ),
    'privateRecipes', (
      select coalesce(jsonb_agg(pr_agg), '[]'::jsonb)
      from (
        select pr.*
        from private_recipes pr
        where pr.user_id = p_user_id and pr.diet_plan_id = p_plan_id
      ) pr_agg
    ),
    'freeMeals', (
      select coalesce(jsonb_agg(fm_agg), '[]'::jsonb)
      from (
        select
          fro.*,
          fr.name,
          fr.instructions,
          fr.prep_time_min,
          fr.difficulty,
          fr.day_meal_id,
          (
            select jsonb_agg(jsonb_build_object(
              'food_id', fri.food_id,
              'grams', fri.grams
            ))
            from free_recipe_ingredients fri
            where fri.free_recipe_id = fr.id
          ) as free_recipe_ingredients,
          fro.id as occurrence_id
        from free_recipe_occurrences fro
        join free_recipes fr on fro.free_recipe_id = fr.id
        where fro.user_id = p_user_id
          and (fr.diet_plan_id = p_plan_id or fr.diet_plan_id is null)
          and fro.meal_date between p_start_date and p_end_date
      ) fm_agg
    ),
    'mealLogs', (
      select coalesce(jsonb_agg(dml), '[]'::jsonb) from daily_meal_logs dml
      where dml.user_id = p_user_id and dml.log_date between p_start_date and p_end_date
    ),
    'userDayMeals', (
      select coalesce(jsonb_agg(udm_agg), '[]'::jsonb)
      from (
        select udm.*, dm.name as day_meal_name, dm.display_order
        from user_day_meals udm
        join day_meals dm on udm.day_meal_id = dm.id
        where udm.user_id = p_user_id
        order by dm.display_order
      ) udm_agg
    )
  ) into result;

  return result;
end;
$$;

-- Full user deletion now removes canonical user-owned foods.
create or replace function public.delete_user_complete(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  plan_record record;
  food_record record;
begin
  if not is_admin() then
    raise exception 'Only admins can delete users.';
  end if;

  delete from daily_ingredient_adjustments
  where equivalence_adjustment_id in (
    select id from equivalence_adjustments where user_id = p_user_id
  );

  delete from equivalence_adjustments where user_id = p_user_id;

  for plan_record in select id from diet_plans where user_id = p_user_id loop
    perform delete_diet_plan_with_dependencies(plan_record.id);
  end loop;

  delete from daily_meal_logs where user_id = p_user_id;
  delete from daily_snack_logs where user_id = p_user_id;
  delete from daily_plan_snapshots where user_id = p_user_id;
  delete from plan_adherence_logs where user_id = p_user_id;
  delete from planned_meals where user_id = p_user_id;
  delete from diet_change_requests where user_id = p_user_id;

  delete from free_recipe_occurrences where user_id = p_user_id;
  delete from free_recipe_ingredients where free_recipe_id in (select id from free_recipes where user_id = p_user_id);
  delete from free_recipes where user_id = p_user_id;

  delete from private_recipe_ingredients where private_recipe_id in (select id from private_recipes where user_id = p_user_id);
  delete from private_recipes where user_id = p_user_id;

  delete from snack_occurrences where user_id = p_user_id;
  delete from snack_ingredients where snack_id in (select id from snacks where user_id = p_user_id);
  delete from snacks where user_id = p_user_id;

  for food_record in select id from food where user_id = p_user_id loop
    perform delete_food_with_dependencies(food_record.id);
  end loop;

  delete from user_day_meals where user_id = p_user_id;
  delete from shopping_list_items where user_id = p_user_id;
  delete from private_shopping_list_items where user_id = p_user_id;
  delete from weight_logs where user_id = p_user_id;
  delete from diet_preferences where user_id = p_user_id;
  delete from training_preferences where user_id = p_user_id;
  delete from user_individual_food_restrictions where user_id = p_user_id;
  delete from user_medical_conditions where user_id = p_user_id;
  delete from user_sensitivities where user_id = p_user_id;
  delete from preferred_foods where user_id = p_user_id;
  delete from non_preferred_foods where user_id = p_user_id;
  delete from user_utilities where user_id = p_user_id;
  delete from user_notifications where user_id = p_user_id;
  delete from advisories where user_id = p_user_id;
  delete from reminders where user_id = p_user_id;

  delete from coach_clients where client_id = p_user_id or coach_id = p_user_id;
  delete from user_centers where user_id = p_user_id;
  delete from user_roles where user_id = p_user_id;

  update diet_plan_centers set assigned_by = null where assigned_by = p_user_id;

  delete from profiles where user_id = p_user_id;
  delete from auth.users where id = p_user_id;
end;
$$;

commit;
