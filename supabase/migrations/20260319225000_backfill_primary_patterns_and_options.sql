-- Backfill missing primary patterns and regenerate pattern equipment options where needed.

-- 1) Promote one secondary pattern to primary when exercise lacks primary.
with no_primary as (
  select e.id as exercise_id
  from public.exercises e
  where not exists (
    select 1
    from public.exercise_movement_patterns emp
    where emp.exercise_id = e.id
      and emp.is_primary
  )
), ranked_secondary as (
  select emp.exercise_id,
         emp.pattern_id,
         p.code,
         row_number() over (
           partition by emp.exercise_id
           order by case p.code
             when 'traccion_horizontal' then 10
             when 'traccion_vertical' then 20
             when 'empuje_horizontal' then 30
             when 'empuje_vertical' then 40
             when 'extension_cadera' then 50
             when 'extension_rodilla' then 60
             when 'flexion_rodilla' then 70
             when 'flexion_plantar_tobillo' then 80
             when 'dorsiflexion_tobillo' then 90
             when 'flexion_tronco' then 100
             when 'anti_extension_tronco' then 110
             when 'anti_rotacion_tronco' then 120
             when 'locomocion_cargada' then 130
             when 'cardio' then 140
             when 'flexion_codo' then 150
             when 'extension_codo' then 160
             when 'abduccion_cadera' then 170
             when 'aduccion_cadera' then 180
             when 'agarre' then 190
             when 'anti_flexion_lateral_tronco' then 200
             else 999
           end
         ) as rn
  from public.exercise_movement_patterns emp
  join public.training_movement_patterns p on p.id = emp.pattern_id
  join no_primary np on np.exercise_id = emp.exercise_id
)
update public.exercise_movement_patterns emp
set is_primary = true,
    source = 'taxonomy_backfill_20260319225000'
from ranked_secondary rs
where emp.exercise_id = rs.exercise_id
  and emp.pattern_id = rs.pattern_id
  and rs.rn = 1;

-- 2) Do not keep noisy secondaries for cardio-only primary exercises.
delete from public.exercise_movement_patterns emp
using public.exercise_movement_patterns primary_emp
join public.training_movement_patterns p on p.id = primary_emp.pattern_id
where primary_emp.exercise_id = emp.exercise_id
  and primary_emp.is_primary
  and p.code = 'cardio'
  and not emp.is_primary;

-- 3) Ensure there is at most one primary pattern per exercise.
with ranked_primary as (
  select emp.exercise_id,
         emp.pattern_id,
         row_number() over (
           partition by emp.exercise_id
           order by emp.pattern_id
         ) as rn
  from public.exercise_movement_patterns emp
  where emp.is_primary
)
update public.exercise_movement_patterns emp
set is_primary = false,
    source = 'taxonomy_backfill_20260319225000'
from ranked_primary rp
where emp.exercise_id = rp.exercise_id
  and emp.pattern_id = rp.pattern_id
  and rp.rn > 1;

-- 4) Insert pattern equipment options for exercises that now have primary.
with pattern_equipment as (
  select 'traccion_horizontal'::text as pattern_code, 'polea baja'::text as equipment_name, 20::smallint as priority union all
  select 'traccion_horizontal', 'mancuernas', 30 union all
  select 'traccion_horizontal', 'barra olimpica', 40 union all
  select 'traccion_horizontal', 'aros de gimnasia', 50 union all
  select 'traccion_horizontal', 'trx', 60 union all
  select 'traccion_horizontal', 'barra baja (remo invertido)', 70 union all
  select 'traccion_horizontal', 'maquina guiada', 80 union all

  select 'traccion_vertical', 'barra alta (dominadas)', 20 union all
  select 'traccion_vertical', 'polea alta', 30 union all
  select 'traccion_vertical', 'aros de gimnasia', 40 union all
  select 'traccion_vertical', 'trx', 50 union all
  select 'traccion_vertical', 'bandas elasticas', 60 union all

  select 'empuje_horizontal', 'peso corporal', 20 union all
  select 'empuje_horizontal', 'mancuernas', 30 union all
  select 'empuje_horizontal', 'barra olimpica', 40 union all
  select 'empuje_horizontal', 'maquina guiada', 50 union all
  select 'empuje_horizontal', 'agarre bajo/paralletes', 60 union all
  select 'empuje_horizontal', 'aros de gimnasia', 70 union all
  select 'empuje_horizontal', 'bandas elasticas', 80 union all

  select 'empuje_vertical', 'mancuernas', 20 union all
  select 'empuje_vertical', 'barra olimpica', 30 union all
  select 'empuje_vertical', 'maquina guiada', 40 union all
  select 'empuje_vertical', 'bandas elasticas', 50 union all
  select 'empuje_vertical', 'peso corporal', 60 union all

  select 'flexion_codo', 'mancuernas', 20 union all
  select 'flexion_codo', 'barra olimpica', 30 union all
  select 'flexion_codo', 'polea baja', 40 union all
  select 'flexion_codo', 'bandas elasticas', 50 union all
  select 'flexion_codo', 'maquina guiada', 60 union all

  select 'extension_codo', 'mancuernas', 20 union all
  select 'extension_codo', 'barra olimpica', 30 union all
  select 'extension_codo', 'polea alta', 40 union all
  select 'extension_codo', 'bandas elasticas', 50 union all
  select 'extension_codo', 'maquina guiada', 60 union all

  select 'extension_cadera', 'peso corporal', 20 union all
  select 'extension_cadera', 'mancuernas', 30 union all
  select 'extension_cadera', 'kettlebell', 40 union all
  select 'extension_cadera', 'barra olimpica', 50 union all
  select 'extension_cadera', 'maquina guiada', 60 union all

  select 'extension_rodilla', 'maquina guiada', 20 union all
  select 'extension_rodilla', 'peso corporal', 30 union all
  select 'extension_rodilla', 'mancuernas', 40 union all
  select 'extension_rodilla', 'barra olimpica', 50 union all
  select 'extension_rodilla', 'kettlebell', 60 union all

  select 'flexion_rodilla', 'maquina guiada', 20 union all
  select 'flexion_rodilla', 'tobilleras lastradas', 30 union all
  select 'flexion_rodilla', 'bandas elasticas', 40 union all
  select 'flexion_rodilla', 'peso corporal', 50 union all

  select 'abduccion_cadera', 'maquina guiada', 20 union all
  select 'abduccion_cadera', 'bandas elasticas', 30 union all
  select 'abduccion_cadera', 'peso corporal', 40 union all

  select 'aduccion_cadera', 'maquina guiada', 20 union all
  select 'aduccion_cadera', 'bandas elasticas', 30 union all
  select 'aduccion_cadera', 'peso corporal', 40 union all

  select 'flexion_plantar_tobillo', 'maquina guiada', 20 union all
  select 'flexion_plantar_tobillo', 'peso corporal', 30 union all
  select 'flexion_plantar_tobillo', 'mancuernas', 40 union all

  select 'dorsiflexion_tobillo', 'peso corporal', 20 union all
  select 'dorsiflexion_tobillo', 'bandas elasticas', 30 union all
  select 'dorsiflexion_tobillo', 'tobilleras lastradas', 40 union all

  select 'flexion_tronco', 'peso corporal', 20 union all
  select 'flexion_tronco', 'maquina guiada', 30 union all
  select 'flexion_tronco', 'barra alta (dominadas)', 40 union all
  select 'flexion_tronco', 'agarre bajo/paralletes', 50 union all

  select 'anti_extension_tronco', 'peso corporal', 20 union all
  select 'anti_extension_tronco', 'aros de gimnasia', 30 union all
  select 'anti_extension_tronco', 'trx', 40 union all

  select 'anti_rotacion_tronco', 'peso corporal', 20 union all
  select 'anti_rotacion_tronco', 'polea baja', 30 union all
  select 'anti_rotacion_tronco', 'bandas elasticas', 40 union all

  select 'anti_flexion_lateral_tronco', 'peso corporal', 20 union all
  select 'anti_flexion_lateral_tronco', 'mancuernas', 30 union all
  select 'anti_flexion_lateral_tronco', 'kettlebell', 40 union all
  select 'anti_flexion_lateral_tronco', 'polea baja', 50 union all

  select 'locomocion_cargada', 'mancuernas', 20 union all
  select 'locomocion_cargada', 'kettlebell', 30 union all
  select 'locomocion_cargada', 'barra olimpica', 40 union all

  select 'agarre', 'barra alta (dominadas)', 20 union all
  select 'agarre', 'mancuernas', 30 union all
  select 'agarre', 'kettlebell', 40 union all

  select 'cardio', 'comba', 20 union all
  select 'cardio', 'bicicleta estatica', 30 union all
  select 'cardio', 'escaleras', 40 union all
  select 'cardio', 'cinta de correr', 50
)
insert into public.exercise_equipment_options (exercise_id, equipment_id, is_default, priority, notes)
select distinct emp.exercise_id,
       eq.id as equipment_id,
       false as is_default,
       pe.priority,
       format('pattern option: %s', pe.pattern_code) as notes
from public.exercise_movement_patterns emp
join public.training_movement_patterns p on p.id = emp.pattern_id and emp.is_primary
join pattern_equipment pe on pe.pattern_code = p.code
join public.equipment eq on lower(eq.name) = lower(pe.equipment_name)
on conflict (exercise_id, equipment_id) do update
set priority = least(public.exercise_equipment_options.priority, excluded.priority);
