-- Refine movement taxonomy for intelligent routine planning (beta)

-- 1) Pattern->muscle target model
create table if not exists public.training_movement_pattern_muscles (
  pattern_id bigint not null references public.training_movement_patterns(id) on delete cascade,
  muscle_id bigint not null references public.muscles(id) on delete cascade,
  target_role text not null check (target_role in ('primary', 'secondary', 'stabilizer')),
  contribution numeric(4,2) not null default 1.00 check (contribution > 0 and contribution <= 1),
  created_at timestamptz not null default now(),
  primary key (pattern_id, muscle_id, target_role)
);

alter table public.training_movement_pattern_muscles enable row level security;

drop policy if exists "Allow read to all pattern muscles" on public.training_movement_pattern_muscles;
create policy "Allow read to all pattern muscles"
on public.training_movement_pattern_muscles
for select using (true);

drop policy if exists "Allow admin full access on pattern muscles" on public.training_movement_pattern_muscles;
create policy "Allow admin full access on pattern muscles"
on public.training_movement_pattern_muscles
for all
using (
  exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and r.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and r.role = 'admin'
  )
);

grant all on table public.training_movement_pattern_muscles to anon, authenticated, service_role;

-- 2) Taxonomy v2 (global + analytical patterns)
insert into public.training_movement_patterns (code, name, description)
values
  ('empuje_horizontal', 'Empuje Horizontal', 'Press/flexiones horizontales'),
  ('empuje_vertical', 'Empuje Vertical', 'Presses verticales y variantes'),
  ('traccion_horizontal', 'Traccion Horizontal', 'Remos y tirones horizontales'),
  ('traccion_vertical', 'Traccion Vertical', 'Dominadas y jalones verticales'),
  ('flexion_codo', 'Flexion de Codo', 'Trabajo dominante de biceps'),
  ('extension_codo', 'Extension de Codo', 'Trabajo dominante de triceps'),
  ('extension_cadera', 'Extension de Cadera', 'Hinge, hip thrust y dominancia de cadera'),
  ('flexion_rodilla', 'Flexion de Rodilla', 'Trabajo dominante de isquios/gemelos'),
  ('extension_rodilla', 'Extension de Rodilla', 'Trabajo dominante de cuadriceps'),
  ('abduccion_cadera', 'Abduccion de Cadera', 'Trabajo de gluteo medio/menor'),
  ('aduccion_cadera', 'Aduccion de Cadera', 'Trabajo dominante de aductores'),
  ('flexion_plantar_tobillo', 'Flexion Plantar Tobillo', 'Trabajo dominante de gemelos'),
  ('dorsiflexion_tobillo', 'Dorsiflexion Tobillo', 'Trabajo dominante de tibial anterior'),
  ('flexion_tronco', 'Flexion de Tronco', 'Compresion/flexion abdominal'),
  ('anti_extension_tronco', 'Anti-Extension de Tronco', 'Estabilidad anti-extension'),
  ('anti_rotacion_tronco', 'Anti-Rotacion de Tronco', 'Estabilidad anti-rotacion'),
  ('anti_flexion_lateral_tronco', 'Anti-Flexion Lateral Tronco', 'Estabilidad frontal/anti-inclinacion'),
  ('locomocion_cargada', 'Locomocion Cargada', 'Carries y desplazamiento con carga'),
  ('agarre', 'Agarre', 'Trabajo de agarre y antebrazo'),
  ('cardio', 'Cardio', 'Condicionamiento cardiovascular')
on conflict (code) do update
set name = excluded.name,
    description = excluded.description;

-- Remove legacy patterns no longer used in v2 taxonomy
with keep as (
  select unnest(array[
    'empuje_horizontal','empuje_vertical','traccion_horizontal','traccion_vertical',
    'flexion_codo','extension_codo','extension_cadera','flexion_rodilla','extension_rodilla',
    'abduccion_cadera','aduccion_cadera','flexion_plantar_tobillo','dorsiflexion_tobillo',
    'flexion_tronco','anti_extension_tronco','anti_rotacion_tronco','anti_flexion_lateral_tronco',
    'locomocion_cargada','agarre','cardio'
  ]) as code
)
delete from public.training_movement_patterns p
where not exists (select 1 from keep k where k.code = p.code);

-- 3) Rebuild exercise<->pattern links (primary + selected secondary)
delete from public.exercise_movement_patterns;

with p as (
  select code, id from public.training_movement_patterns
), primary_map as (
  select e.id as exercise_id,
         case
           when lower(e.name) like '%remo%' then 'traccion_horizontal'
           when lower(e.name) like '%face pull%' then 'traccion_horizontal'
           when lower(e.name) like '%dominad%' then 'traccion_vertical'
           when lower(e.name) like '%jalon%' then 'traccion_vertical'

           when lower(e.name) like '%press militar%' then 'empuje_vertical'
           when lower(e.name) like '%flexiones de pico%' then 'empuje_vertical'

           when lower(e.name) like '%press banca%' then 'empuje_horizontal'
           when lower(e.name) like '%press horizontal%' then 'empuje_horizontal'
           when lower(e.name) like '%contractora%' then 'empuje_horizontal'
           when lower(e.name) like '%flexiones%' and lower(e.name) not like '%muneca%' and lower(e.name) not like '%tibial%' then 'empuje_horizontal'
           when lower(e.name) like '%fondo%' then 'empuje_horizontal'

           when lower(e.name) like '%sentadilla%' then 'extension_rodilla'
           when lower(e.name) like '%prensa%' then 'extension_rodilla'
           when lower(e.name) like '%hack%' then 'extension_rodilla'
           when lower(e.name) like '%step up%' then 'extension_rodilla'
           when lower(e.name) like '%pistol%' then 'extension_rodilla'

           when lower(e.name) like '%peso muerto%' then 'extension_cadera'
           when lower(e.name) like '%buenos dias%' then 'extension_cadera'
           when lower(e.name) like '%hip thrust%' then 'extension_cadera'
           when lower(e.name) like '%puente de gluteo%' then 'extension_cadera'
           when lower(e.name) like '%kettlebell swing%' then 'extension_cadera'

           when lower(e.name) like '%zancada%' then 'zancada_unilateral' -- fallback handled below
           when lower(e.name) like '%curl femoral%' then 'flexion_rodilla'
           when lower(e.name) like '%extension de cuadriceps%' then 'extension_rodilla'
           when lower(e.name) like '%gemelos%' or lower(e.name) like '%elevacion de talones%' then 'flexion_plantar_tobillo'
           when lower(e.name) like '%tibial%' then 'dorsiflexion_tobillo'

           when lower(e.name) like '%abduccion%' then 'abduccion_cadera'
           when lower(e.name) like '%aduccion%' then 'aduccion_cadera'

           when lower(e.name) like '%plancha%' or lower(e.name) like '%hollow%' then 'anti_extension_tronco'
           when lower(e.name) like '%pallof%' or lower(e.name) like '%bird dog%' then 'anti_rotacion_tronco'
           when lower(e.name) like '%abs%' or lower(e.name) like '%knee raises%' then 'flexion_tronco'

           when lower(e.name) like '%farmer carry%' or lower(e.name) like '%paseo del granjero%' then 'locomocion_cargada'
           when lower(e.name) like '%agarre%' or lower(e.name) like '%muneca%' then 'agarre'

           when lower(e.name) in ('comba', 'bici', 'carrera', 'escaleras') then 'cardio'
           else null
         end as pattern_code
  from public.exercises e
), normalized_primary as (
  select exercise_id,
         case when pattern_code = 'zancada_unilateral' then 'extension_rodilla' else pattern_code end as pattern_code
  from primary_map
)
insert into public.exercise_movement_patterns (exercise_id, pattern_id, is_primary, source)
select pm.exercise_id, p.id, true, 'taxonomy_20260319224000'
from normalized_primary pm
join p on p.code = pm.pattern_code
where pm.pattern_code is not null
on conflict (exercise_id, pattern_id) do update
set is_primary = excluded.is_primary,
    source = excluded.source;

-- Secondary analytical links based on muscles
with p as (
  select code, id from public.training_movement_patterns
), em as (
  select em.exercise_id,
         bool_or(lower(m.name) = 'biceps') as has_biceps,
         bool_or(lower(m.name) = 'triceps') as has_triceps,
         bool_or(lower(m.name) = 'aductores') as has_adductores,
         bool_or(lower(m.name) = 'gluteo medio' or lower(m.name) = 'gluteo menor') as has_abductores,
         bool_or(lower(m.name) = 'oblicuos' or lower(m.name) = 'cuadrado lumbar') as has_anti_flex_lateral,
         bool_or(lower(m.name) = 'flexores de muneca' or lower(m.name) = 'extensores de muneca') as has_agarre
  from public.exercise_muscles em
  join public.muscles m on m.id = em.muscle_id
  group by em.exercise_id
)
insert into public.exercise_movement_patterns (exercise_id, pattern_id, is_primary, source)
select em.exercise_id,
       p.id,
       false,
       'taxonomy_20260319224000'
from em
join p on (
  (p.code = 'flexion_codo' and em.has_biceps)
  or (p.code = 'extension_codo' and em.has_triceps)
  or (p.code = 'abduccion_cadera' and em.has_abductores)
  or (p.code = 'aduccion_cadera' and em.has_adductores)
  or (p.code = 'anti_flexion_lateral_tronco' and em.has_anti_flex_lateral)
  or (p.code = 'agarre' and em.has_agarre)
)
on conflict (exercise_id, pattern_id) do nothing;

-- 4) Seed pattern->muscle targets
truncate table public.training_movement_pattern_muscles;

with p as (
  select code, id from public.training_movement_patterns
), m as (
  select lower(name) as name, id from public.muscles
), rows as (
  select 'empuje_horizontal'::text as pattern_code, 'pectoral'::text as muscle_name, 'primary'::text as target_role, 1.00::numeric as contribution union all
  select 'empuje_horizontal', 'deltoides anterior', 'secondary', 0.70 union all
  select 'empuje_horizontal', 'triceps', 'secondary', 0.70 union all

  select 'empuje_vertical', 'deltoides anterior', 'primary', 1.00 union all
  select 'empuje_vertical', 'deltoides lateral', 'secondary', 0.70 union all
  select 'empuje_vertical', 'triceps', 'secondary', 0.70 union all
  select 'empuje_vertical', 'trapecio', 'stabilizer', 0.50 union all

  select 'traccion_horizontal', 'dorsal ancho', 'primary', 1.00 union all
  select 'traccion_horizontal', 'romboides', 'primary', 1.00 union all
  select 'traccion_horizontal', 'deltoides posterior', 'secondary', 0.70 union all
  select 'traccion_horizontal', 'biceps', 'secondary', 0.70 union all
  select 'traccion_horizontal', 'trapecio', 'secondary', 0.60 union all

  select 'traccion_vertical', 'dorsal ancho', 'primary', 1.00 union all
  select 'traccion_vertical', 'biceps', 'secondary', 0.70 union all
  select 'traccion_vertical', 'romboides', 'secondary', 0.60 union all
  select 'traccion_vertical', 'deltoides posterior', 'secondary', 0.60 union all

  select 'flexion_codo', 'biceps', 'primary', 1.00 union all
  select 'flexion_codo', 'flexores de muneca', 'stabilizer', 0.50 union all
  select 'flexion_codo', 'extensores de muneca', 'stabilizer', 0.40 union all

  select 'extension_codo', 'triceps', 'primary', 1.00 union all

  select 'extension_cadera', 'gluteo mayor', 'primary', 1.00 union all
  select 'extension_cadera', 'isquiotibiales', 'secondary', 0.80 union all
  select 'extension_cadera', 'erectores espinales', 'secondary', 0.60 union all
  select 'extension_cadera', 'aductores', 'secondary', 0.40 union all

  select 'flexion_rodilla', 'isquiotibiales', 'primary', 1.00 union all
  select 'flexion_rodilla', 'gemelos', 'secondary', 0.50 union all

  select 'extension_rodilla', 'cuadriceps', 'primary', 1.00 union all
  select 'extension_rodilla', 'gluteo mayor', 'secondary', 0.60 union all
  select 'extension_rodilla', 'aductores', 'secondary', 0.50 union all

  select 'abduccion_cadera', 'gluteo medio', 'primary', 1.00 union all
  select 'abduccion_cadera', 'gluteo menor', 'primary', 0.90 union all

  select 'aduccion_cadera', 'aductores', 'primary', 1.00 union all

  select 'flexion_plantar_tobillo', 'gemelos', 'primary', 1.00 union all

  select 'dorsiflexion_tobillo', 'tibial anterior', 'primary', 1.00 union all

  select 'flexion_tronco', 'recto abdominal', 'primary', 1.00 union all
  select 'flexion_tronco', 'oblicuos', 'secondary', 0.70 union all

  select 'anti_extension_tronco', 'recto abdominal', 'primary', 1.00 union all
  select 'anti_extension_tronco', 'oblicuos', 'secondary', 0.70 union all
  select 'anti_extension_tronco', 'erectores espinales', 'secondary', 0.50 union all

  select 'anti_rotacion_tronco', 'oblicuos', 'primary', 1.00 union all
  select 'anti_rotacion_tronco', 'recto abdominal', 'secondary', 0.60 union all

  select 'anti_flexion_lateral_tronco', 'oblicuos', 'primary', 1.00 union all
  select 'anti_flexion_lateral_tronco', 'cuadrado lumbar', 'secondary', 0.70 union all

  select 'locomocion_cargada', 'flexores de muneca', 'primary', 1.00 union all
  select 'locomocion_cargada', 'extensores de muneca', 'secondary', 0.70 union all
  select 'locomocion_cargada', 'trapecio', 'secondary', 0.70 union all
  select 'locomocion_cargada', 'oblicuos', 'secondary', 0.60 union all

  select 'agarre', 'flexores de muneca', 'primary', 1.00 union all
  select 'agarre', 'extensores de muneca', 'secondary', 0.80
)
insert into public.training_movement_pattern_muscles (pattern_id, muscle_id, target_role, contribution)
select p.id, m.id, r.target_role, r.contribution
from rows r
join p on p.code = r.pattern_code
join m on m.name = lower(r.muscle_name)
on conflict do nothing;

-- 5) Rebuild pattern-generated equipment options using taxonomy v2
insert into public.equipment (name, progression)
select 'cinta de correr', 'cardio'
where not exists (select 1 from public.equipment where lower(name) = 'cinta de correr');

delete from public.exercise_equipment_options
where notes like 'pattern option:%';

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

-- 6) Alternatives function: use only primary patterns as similarity base
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
    and is_primary
), candidates as (
  select distinct e.id, e.name
  from public.exercises e
  join public.exercise_movement_patterns emp on emp.exercise_id = e.id and emp.is_primary
  join base_patterns bp on bp.pattern_id = emp.pattern_id
  where e.id <> p_exercise_id
), candidate_patterns as (
  select c.id as exercise_id,
         array_agg(distinct p.name order by p.name) as matching_patterns
  from candidates c
  join public.exercise_movement_patterns emp on emp.exercise_id = c.id and emp.is_primary
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
