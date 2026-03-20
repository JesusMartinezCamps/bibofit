-- Final primary-pattern fixes for edge exercise names

with p as (
  select code, id from public.training_movement_patterns
), targets as (
  select e.id as exercise_id,
         case
           when lower(e.name) in (lower('Elevaciones Hombro Medio'), lower('Elevaciones laterales con mancuernas')) then 'empuje_vertical'
           when lower(e.name) = lower('Elevaciones Hombro Posterior') then 'traccion_horizontal'
           when lower(e.name) = lower('Extensión de Cuádriceps') then 'extension_rodilla'
           when lower(e.name) = lower('Front Lever') then 'traccion_vertical'
           when lower(e.name) = lower('Hiperextensión Lumbar') then 'extension_cadera'
           else null
         end as pattern_code
  from public.exercises e
)
insert into public.exercise_movement_patterns (exercise_id, pattern_id, is_primary, source)
select t.exercise_id, p.id, true, 'taxonomy_fix_20260319230000'
from targets t
join p on p.code = t.pattern_code
where t.pattern_code is not null
on conflict (exercise_id, pattern_id) do update
set is_primary = true,
    source = excluded.source;

-- ensure single primary per exercise
with ranked_primary as (
  select emp.exercise_id,
         emp.pattern_id,
         row_number() over (
           partition by emp.exercise_id
           order by case
             when emp.source like 'taxonomy_fix_%' then 1
             when emp.source like 'taxonomy_backfill_%' then 2
             else 3
           end, emp.pattern_id
         ) as rn
  from public.exercise_movement_patterns emp
  where emp.is_primary
)
update public.exercise_movement_patterns emp
set is_primary = false,
    source = 'taxonomy_fix_20260319230000'
from ranked_primary rp
where emp.exercise_id = rp.exercise_id
  and emp.pattern_id = rp.pattern_id
  and rp.rn > 1;
