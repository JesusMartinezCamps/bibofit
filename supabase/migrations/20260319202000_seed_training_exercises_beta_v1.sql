-- Beta v1 training seed: wrist flexor/extensor split + exercise catalog + explicit cervical loading

-- 1) Split forearms into wrist flexors/extensors.
insert into public.muscles (name, partes_cuerpo, patron_movimiento)
select 'flexores de muneca', 'brazos', 'agarre'
where not exists (
  select 1 from public.muscles where lower(name) = 'flexores de muneca'
);

insert into public.muscles (name, partes_cuerpo, patron_movimiento)
select 'extensores de muneca', 'brazos', 'agarre'
where not exists (
  select 1 from public.muscles where lower(name) = 'extensores de muneca'
);

with old as (
  select id from public.muscles where lower(name) = 'antebrazos' limit 1
), f as (
  select id from public.muscles where lower(name) = 'flexores de muneca' limit 1
), e as (
  select id from public.muscles where lower(name) = 'extensores de muneca' limit 1
)
insert into public.exercise_muscles (exercise_id, muscle_id)
select em.exercise_id, f.id
from public.exercise_muscles em
cross join old
cross join f
where em.muscle_id = old.id
on conflict do nothing;

with old as (
  select id from public.muscles where lower(name) = 'antebrazos' limit 1
), e as (
  select id from public.muscles where lower(name) = 'extensores de muneca' limit 1
)
insert into public.exercise_muscles (exercise_id, muscle_id)
select em.exercise_id, e.id
from public.exercise_muscles em
cross join old
cross join e
where em.muscle_id = old.id
on conflict do nothing;

with old as (
  select id from public.muscles where lower(name) = 'antebrazos' limit 1
), f as (
  select id from public.muscles where lower(name) = 'flexores de muneca' limit 1
)
insert into public.muscle_joints (muscle_id, joint_id)
select f.id, mj.joint_id
from public.muscle_joints mj
cross join old
cross join f
where mj.muscle_id = old.id
on conflict do nothing;

with old as (
  select id from public.muscles where lower(name) = 'antebrazos' limit 1
), e as (
  select id from public.muscles where lower(name) = 'extensores de muneca' limit 1
)
insert into public.muscle_joints (muscle_id, joint_id)
select e.id, mj.joint_id
from public.muscle_joints mj
cross join old
cross join e
where mj.muscle_id = old.id
on conflict do nothing;

with old as (
  select id from public.muscles where lower(name) = 'antebrazos' limit 1
)
delete from public.exercise_muscles em
using old
where em.muscle_id = old.id;

with old as (
  select id from public.muscles where lower(name) = 'antebrazos' limit 1
)
delete from public.muscle_joints mj
using old
where mj.muscle_id = old.id;

-- Remove legacy antebrazos node when no longer referenced.
delete from public.muscles m
where lower(m.name) = 'antebrazos'
  and not exists (select 1 from public.exercise_muscles em where em.muscle_id = m.id)
  and not exists (select 1 from public.muscle_joints mj where mj.muscle_id = m.id);

-- 2) Rebuild muscle->joint map without automatic cervical overload.
delete from public.muscle_joints;

insert into public.muscle_joints (muscle_id, joint_id)
select m.id, j.id
from (
  values
    ('flexores de muneca', 'munecas'),
    ('flexores de muneca', 'codos'),
    ('extensores de muneca', 'munecas'),
    ('extensores de muneca', 'codos'),
    ('biceps', 'codos'),
    ('biceps', 'hombros'),
    ('triceps', 'codos'),
    ('triceps', 'hombros'),
    ('deltoides anterior', 'hombros'),
    ('deltoides lateral', 'hombros'),
    ('deltoides posterior', 'hombros'),
    ('pectoral', 'hombros'),
    ('trapecio', 'hombros'),
    ('romboides', 'hombros'),
    ('dorsal ancho', 'hombros'),
    ('erectores espinales', 'columna lumbar'),
    ('cuadrado lumbar', 'columna lumbar'),
    ('recto abdominal', 'columna lumbar'),
    ('oblicuos', 'columna lumbar'),
    ('aductores', 'cadera'),
    ('gluteo mayor', 'cadera'),
    ('gluteo medio', 'cadera'),
    ('gluteo menor', 'cadera'),
    ('cuadriceps', 'rodillas'),
    ('cuadriceps', 'cadera'),
    ('isquiotibiales', 'rodillas'),
    ('isquiotibiales', 'cadera'),
    ('gemelos', 'tobillos'),
    ('gemelos', 'rodillas'),
    ('tibial anterior', 'tobillos')
) as map(muscle_name, joint_name)
join public.muscles m on m.name = map.muscle_name
join public.joints j on j.name = map.joint_name
on conflict do nothing;

-- 3) Seed/refresh beta exercise catalog.
create temporary table tmp_seed_exercises (
  name text,
  unilateral boolean,
  equipment_id bigint,
  technique text
) on commit drop;

insert into tmp_seed_exercises (name, unilateral, equipment_id, technique)
values
  ('Pistol Squat', true, 1, 'Control en bajada, equilibrio y empuje de pierna.'),
  ('Flexiones', false, 1, 'Rango completo y control escapular.'),
  ('Flexiones en paralletes', false, 16, 'Mayor rango de movimiento con muneca neutra.'),
  ('Press militar con mancuernas', false, 2, 'Bloqueo controlado sin hiperextension lumbar.'),
  ('Remo unilateral con mancuerna', true, 2, 'Tiron hacia cadera con escapula activa.'),
  ('Dominadas en barra alta', false, 23, 'Iniciar con depresion escapular y tiron vertical.'),
  ('Remo invertido en barra baja', false, 24, 'Cuerpo alineado y tiron al esternon.'),
  ('Fondos en anillas', false, 12, 'Control de estabilidad y recorrido sin dolor.'),
  ('Curl de biceps con mancuernas', false, 2, 'Evitar balanceo, controlar la negativa.'),
  ('Extension de triceps en cuerda', false, 18, 'Codos fijos y extension completa.'),
  ('Face pull en polea alta', false, 9, 'Tiron a la cara con rotacion externa.'),
  ('Elevaciones laterales con mancuernas', false, 2, 'Subida controlada sin impulso de tronco.'),
  ('Plancha frontal', false, 1, 'Linea neutra de tobillo a hombro.'),
  ('Plancha lateral', true, 1, 'Estabilidad lateral de core y cadera.'),
  ('Sentadilla goblet', false, 2, 'Torso estable y profundidad activa.'),
  ('Sentadilla trasera barra alta', false, 4, 'Barra alta sobre trapecio, torso mas vertical.'),
  ('Sentadilla trasera barra baja', false, 4, 'Barra baja, mayor cadera y cadena posterior.'),
  ('Sentadilla bulgara', true, 2, 'Rodilla alineada y apoyo trasero estable.'),
  ('Zancada caminando', true, 2, 'Paso controlado y pelvis neutra.'),
  ('Peso muerto rumano con barra', false, 4, 'Bisagra de cadera y tension en isquios.'),
  ('Hip thrust con barra', false, 4, 'Extension de cadera con pausa arriba.'),
  ('Puente de gluteo en suelo', false, 1, 'Empuje de talon y retroversion pelvica final.'),
  ('Step-up al banco', true, 14, 'Subida por pierna de apoyo sin impulso del suelo.'),
  ('Curl femoral con tobillera', true, 21, 'Flexion de rodilla controlada.'),
  ('Extension de cuadriceps en maquina', false, 22, 'Extension controlada sin bloqueo agresivo.'),
  ('Elevacion de talones de pie', false, 1, 'Maxima amplitud en tobillo.'),
  ('Tibial raise en pared', false, 1, 'Dorsiflexion completa y controlada.'),
  ('Aductor en maquina', false, 22, 'Aduccion controlada sin rebote.'),
  ('Peso muerto sumo con kettlebell', false, 3, 'Base amplia, rodillas abiertas y cadera abajo.'),
  ('Kettlebell swing', false, 3, 'Potencia de cadera, no de hombros.'),
  ('Remo en polea baja', false, 10, 'Tiron al abdomen con escapulas atras.'),
  ('Jalon al pecho en polea alta', false, 9, 'Llevar codos abajo y atras sin balanceo.'),
  ('Press banca con mancuernas', false, 2, 'Control de trayectoria y escápulas retraidas.'),
  ('Press inclinado con mancuernas', false, 2, 'Empuje inclinado con hombros estables.'),
  ('Farmer carry con mancuernas', false, 2, 'Paso corto, tronco firme y agarre fuerte.'),
  ('Farmer carry unilateral', true, 2, 'Antiinclinacion del tronco durante la marcha.'),
  ('Dead bug', false, 1, 'Control lumbo-pelvico con respiracion.'),
  ('Hollow hold', false, 1, 'Retroversion pelvica y abdomen activo.'),
  ('Bird dog', true, 1, 'Extension cruzada sin rotar tronco.'),
  ('Pallof press en polea', true, 10, 'Antirrotacion con brazos extendidos.'),
  ('Encogimientos de trapecio con mancuernas', false, 2, 'Elevacion escapular vertical sin balanceo.');

insert into public.exercises (name, unilateral, equipment_id, technique)
select s.name, s.unilateral, s.equipment_id, s.technique
from tmp_seed_exercises s
where not exists (
  select 1 from public.exercises e where lower(e.name) = lower(s.name)
);

update public.exercises e
set
  unilateral = s.unilateral,
  equipment_id = s.equipment_id,
  technique = s.technique
from tmp_seed_exercises s
where lower(e.name) = lower(s.name);

-- 4) Rebuild mappings for seeded exercises.
create temporary table tmp_seed_exercise_muscles (
  exercise_name text,
  muscle_name text
) on commit drop;

insert into tmp_seed_exercise_muscles (exercise_name, muscle_name)
values
  ('Pistol Squat', 'cuadriceps'),
  ('Pistol Squat', 'gluteo mayor'),
  ('Pistol Squat', 'gluteo medio'),
  ('Pistol Squat', 'isquiotibiales'),
  ('Pistol Squat', 'erectores espinales'),
  ('Flexiones', 'pectoral'),
  ('Flexiones', 'triceps'),
  ('Flexiones', 'deltoides anterior'),
  ('Flexiones', 'recto abdominal'),
  ('Flexiones en paralletes', 'pectoral'),
  ('Flexiones en paralletes', 'triceps'),
  ('Flexiones en paralletes', 'deltoides anterior'),
  ('Press militar con mancuernas', 'deltoides anterior'),
  ('Press militar con mancuernas', 'deltoides lateral'),
  ('Press militar con mancuernas', 'triceps'),
  ('Press militar con mancuernas', 'trapecio'),
  ('Remo unilateral con mancuerna', 'dorsal ancho'),
  ('Remo unilateral con mancuerna', 'romboides'),
  ('Remo unilateral con mancuerna', 'deltoides posterior'),
  ('Remo unilateral con mancuerna', 'biceps'),
  ('Remo unilateral con mancuerna', 'flexores de muneca'),
  ('Dominadas en barra alta', 'dorsal ancho'),
  ('Dominadas en barra alta', 'romboides'),
  ('Dominadas en barra alta', 'biceps'),
  ('Dominadas en barra alta', 'deltoides posterior'),
  ('Dominadas en barra alta', 'flexores de muneca'),
  ('Remo invertido en barra baja', 'dorsal ancho'),
  ('Remo invertido en barra baja', 'romboides'),
  ('Remo invertido en barra baja', 'biceps'),
  ('Remo invertido en barra baja', 'deltoides posterior'),
  ('Remo invertido en barra baja', 'flexores de muneca'),
  ('Fondos en anillas', 'pectoral'),
  ('Fondos en anillas', 'triceps'),
  ('Fondos en anillas', 'deltoides anterior'),
  ('Fondos en anillas', 'recto abdominal'),
  ('Curl de biceps con mancuernas', 'biceps'),
  ('Curl de biceps con mancuernas', 'flexores de muneca'),
  ('Curl de biceps con mancuernas', 'extensores de muneca'),
  ('Extension de triceps en cuerda', 'triceps'),
  ('Face pull en polea alta', 'deltoides posterior'),
  ('Face pull en polea alta', 'trapecio'),
  ('Face pull en polea alta', 'romboides'),
  ('Face pull en polea alta', 'biceps'),
  ('Elevaciones laterales con mancuernas', 'deltoides lateral'),
  ('Elevaciones laterales con mancuernas', 'trapecio'),
  ('Plancha frontal', 'recto abdominal'),
  ('Plancha frontal', 'oblicuos'),
  ('Plancha frontal', 'erectores espinales'),
  ('Plancha lateral', 'oblicuos'),
  ('Plancha lateral', 'gluteo medio'),
  ('Plancha lateral', 'cuadrado lumbar'),
  ('Sentadilla goblet', 'cuadriceps'),
  ('Sentadilla goblet', 'gluteo mayor'),
  ('Sentadilla goblet', 'gluteo medio'),
  ('Sentadilla goblet', 'aductores'),
  ('Sentadilla goblet', 'erectores espinales'),
  ('Sentadilla trasera barra alta', 'cuadriceps'),
  ('Sentadilla trasera barra alta', 'gluteo mayor'),
  ('Sentadilla trasera barra alta', 'aductores'),
  ('Sentadilla trasera barra alta', 'erectores espinales'),
  ('Sentadilla trasera barra alta', 'trapecio'),
  ('Sentadilla trasera barra baja', 'cuadriceps'),
  ('Sentadilla trasera barra baja', 'gluteo mayor'),
  ('Sentadilla trasera barra baja', 'isquiotibiales'),
  ('Sentadilla trasera barra baja', 'aductores'),
  ('Sentadilla trasera barra baja', 'erectores espinales'),
  ('Sentadilla bulgara', 'cuadriceps'),
  ('Sentadilla bulgara', 'gluteo mayor'),
  ('Sentadilla bulgara', 'gluteo medio'),
  ('Sentadilla bulgara', 'isquiotibiales'),
  ('Sentadilla bulgara', 'aductores'),
  ('Zancada caminando', 'cuadriceps'),
  ('Zancada caminando', 'gluteo mayor'),
  ('Zancada caminando', 'isquiotibiales'),
  ('Zancada caminando', 'aductores'),
  ('Zancada caminando', 'gemelos'),
  ('Peso muerto rumano con barra', 'isquiotibiales'),
  ('Peso muerto rumano con barra', 'gluteo mayor'),
  ('Peso muerto rumano con barra', 'gluteo medio'),
  ('Peso muerto rumano con barra', 'erectores espinales'),
  ('Hip thrust con barra', 'gluteo mayor'),
  ('Hip thrust con barra', 'isquiotibiales'),
  ('Hip thrust con barra', 'aductores'),
  ('Puente de gluteo en suelo', 'gluteo mayor'),
  ('Puente de gluteo en suelo', 'isquiotibiales'),
  ('Puente de gluteo en suelo', 'erectores espinales'),
  ('Step-up al banco', 'cuadriceps'),
  ('Step-up al banco', 'gluteo mayor'),
  ('Step-up al banco', 'gluteo medio'),
  ('Step-up al banco', 'gemelos'),
  ('Curl femoral con tobillera', 'isquiotibiales'),
  ('Curl femoral con tobillera', 'gemelos'),
  ('Extension de cuadriceps en maquina', 'cuadriceps'),
  ('Elevacion de talones de pie', 'gemelos'),
  ('Tibial raise en pared', 'tibial anterior'),
  ('Aductor en maquina', 'aductores'),
  ('Peso muerto sumo con kettlebell', 'aductores'),
  ('Peso muerto sumo con kettlebell', 'gluteo mayor'),
  ('Peso muerto sumo con kettlebell', 'isquiotibiales'),
  ('Peso muerto sumo con kettlebell', 'cuadriceps'),
  ('Peso muerto sumo con kettlebell', 'erectores espinales'),
  ('Kettlebell swing', 'gluteo mayor'),
  ('Kettlebell swing', 'isquiotibiales'),
  ('Kettlebell swing', 'erectores espinales'),
  ('Kettlebell swing', 'trapecio'),
  ('Remo en polea baja', 'dorsal ancho'),
  ('Remo en polea baja', 'romboides'),
  ('Remo en polea baja', 'biceps'),
  ('Remo en polea baja', 'deltoides posterior'),
  ('Remo en polea baja', 'flexores de muneca'),
  ('Jalon al pecho en polea alta', 'dorsal ancho'),
  ('Jalon al pecho en polea alta', 'romboides'),
  ('Jalon al pecho en polea alta', 'biceps'),
  ('Jalon al pecho en polea alta', 'flexores de muneca'),
  ('Press banca con mancuernas', 'pectoral'),
  ('Press banca con mancuernas', 'triceps'),
  ('Press banca con mancuernas', 'deltoides anterior'),
  ('Press inclinado con mancuernas', 'pectoral'),
  ('Press inclinado con mancuernas', 'triceps'),
  ('Press inclinado con mancuernas', 'deltoides anterior'),
  ('Farmer carry con mancuernas', 'trapecio'),
  ('Farmer carry con mancuernas', 'flexores de muneca'),
  ('Farmer carry con mancuernas', 'extensores de muneca'),
  ('Farmer carry con mancuernas', 'recto abdominal'),
  ('Farmer carry con mancuernas', 'oblicuos'),
  ('Farmer carry unilateral', 'trapecio'),
  ('Farmer carry unilateral', 'flexores de muneca'),
  ('Farmer carry unilateral', 'extensores de muneca'),
  ('Farmer carry unilateral', 'oblicuos'),
  ('Farmer carry unilateral', 'erectores espinales'),
  ('Dead bug', 'recto abdominal'),
  ('Dead bug', 'oblicuos'),
  ('Hollow hold', 'recto abdominal'),
  ('Hollow hold', 'oblicuos'),
  ('Bird dog', 'erectores espinales'),
  ('Bird dog', 'oblicuos'),
  ('Bird dog', 'gluteo mayor'),
  ('Bird dog', 'gluteo medio'),
  ('Pallof press en polea', 'oblicuos'),
  ('Pallof press en polea', 'recto abdominal'),
  ('Pallof press en polea', 'deltoides anterior'),
  ('Encogimientos de trapecio con mancuernas', 'trapecio'),
  ('Encogimientos de trapecio con mancuernas', 'flexores de muneca'),
  ('Encogimientos de trapecio con mancuernas', 'extensores de muneca');

with seeded as (
  select e.id
  from public.exercises e
  join tmp_seed_exercises s on lower(s.name) = lower(e.name)
)
delete from public.exercise_muscles em
using seeded
where em.exercise_id = seeded.id;

with seed_map as (
  select distinct e.id as exercise_id, m.id as muscle_id
  from tmp_seed_exercise_muscles map
  join public.exercises e on lower(e.name) = lower(map.exercise_name)
  join public.muscles m on lower(m.name) = lower(map.muscle_name)
)
insert into public.exercise_muscles (exercise_id, muscle_id)
select exercise_id, muscle_id
from seed_map
on conflict do nothing;

with seeded as (
  select e.id
  from public.exercises e
  join tmp_seed_exercises s on lower(s.name) = lower(e.name)
)
delete from public.exercise_joints ej
using seeded
where ej.exercise_id = seeded.id;

insert into public.exercise_joints (exercise_id, joint_id)
select distinct em.exercise_id, mj.joint_id
from public.exercise_muscles em
join public.muscle_joints mj on mj.muscle_id = em.muscle_id
join public.exercises e on e.id = em.exercise_id
join tmp_seed_exercises s on lower(s.name) = lower(e.name)
on conflict do nothing;

-- Explicit cervical load only where we intentionally want it.
insert into public.exercise_joints (exercise_id, joint_id)
select e.id, j.id
from public.exercises e
join public.joints j on j.name = 'columna cervical'
where lower(e.name) in (
  lower('Sentadilla trasera barra alta'),
  lower('Farmer carry con mancuernas'),
  lower('Farmer carry unilateral'),
  lower('Encogimientos de trapecio con mancuernas')
)
on conflict do nothing;
