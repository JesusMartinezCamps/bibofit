-- If user has not configured inventory yet, treat all equipment options as available.
create or replace function public.get_exercise_alternatives(
  p_exercise_id bigint,
  p_user_id uuid default auth.uid(),
  p_only_available boolean default true,
  p_limit integer default 10
)
returns table (
  exercise_id bigint,
  exercise_name text,
  matching_patterns text[],
  equipment_options text[],
  available_equipment_options text[],
  last_workout_date date,
  last_weight integer,
  last_reps integer
)
language sql
stable
as $$
with user_inventory as (
  select exists (
    select 1
    from public.user_equipment ue
    where ue.user_id = p_user_id
  ) as has_inventory
), base_patterns as (
  select pattern_id
  from public.exercise_movement_patterns
  where exercise_id = p_exercise_id
), candidates as (
  select distinct e.id, e.name
  from public.exercises e
  join public.exercise_movement_patterns emp on emp.exercise_id = e.id
  join base_patterns bp on bp.pattern_id = emp.pattern_id
  where e.id <> p_exercise_id
), candidate_patterns as (
  select c.id as exercise_id,
         array_agg(distinct p.name order by p.name) as matching_patterns
  from candidates c
  join public.exercise_movement_patterns emp on emp.exercise_id = c.id
  join base_patterns bp on bp.pattern_id = emp.pattern_id
  join public.training_movement_patterns p on p.id = emp.pattern_id
  group by c.id
), candidate_equipment as (
  select c.id as exercise_id,
         array_agg(distinct eq.name order by eq.name) as equipment_options,
         array_agg(distinct eq.name order by eq.name)
           filter (
             where (
               (select not has_inventory from user_inventory)
               or coalesce(ue.has_access, false)
             )
           ) as available_equipment_options
  from candidates c
  join public.exercise_equipment_options eeo on eeo.exercise_id = c.id
  join public.equipment eq on eq.id = eeo.equipment_id
  left join public.user_equipment ue
    on ue.user_id = p_user_id
   and ue.equipment_id = eeo.equipment_id
  group by c.id
), latest_set as (
  select we.exercise_id,
         w.performed_on,
         es.weight,
         es.reps,
         row_number() over (
           partition by we.exercise_id
           order by w.performed_on desc, es.set_no desc nulls last, es.id desc
         ) as rn
  from public.workout_exercises we
  join public.workouts w on w.id = we.workout_id
  left join public.exercise_sets es on es.workout_exercise_id = we.id
  where w.user_id = p_user_id
)
select c.id as exercise_id,
       c.name as exercise_name,
       cp.matching_patterns,
       ce.equipment_options,
       ce.available_equipment_options,
       ls.performed_on as last_workout_date,
       ls.weight as last_weight,
       ls.reps as last_reps
from candidates c
join candidate_patterns cp on cp.exercise_id = c.id
join candidate_equipment ce on ce.exercise_id = c.id
left join latest_set ls on ls.exercise_id = c.id and ls.rn = 1
where (not p_only_available)
   or (coalesce(array_length(ce.available_equipment_options, 1), 0) > 0)
order by ls.performed_on desc nulls last, c.name
limit greatest(coalesce(p_limit, 10), 1);
$$;
