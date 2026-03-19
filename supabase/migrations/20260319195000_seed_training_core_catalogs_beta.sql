-- Seed/normalize core training catalogs for beta (joints, muscles, equipment)

-- 1) Reset mappings to rebuild against normalized catalogs.
delete from public.exercise_joints;
delete from public.exercise_muscles;
delete from public.muscle_joints;

-- 2) Functional joints (basic and non-clinical wording).
delete from public.joints;

insert into public.joints (id, name)
values
  (1, 'munecas'),
  (2, 'codos'),
  (3, 'hombros'),
  (4, 'columna lumbar'),
  (5, 'cadera'),
  (6, 'rodillas'),
  (7, 'tobillos'),
  (8, 'columna cervical');

-- 3) Muscles/groups: complete but practical for exercise load mapping.
truncate table public.muscles restart identity cascade;

insert into public.muscles (name, partes_cuerpo, patron_movimiento)
values
  ('antebrazos', 'brazos', 'agarre'),
  ('biceps', 'brazos', 'tiron'),
  ('triceps', 'brazos', 'empuje'),
  ('deltoides anterior', 'hombros', 'empuje'),
  ('deltoides lateral', 'hombros', 'estabilidad'),
  ('deltoides posterior', 'hombros', 'tiron'),
  ('pectoral', 'pecho', 'empuje'),
  ('trapecio', 'espalda', 'tiron'),
  ('romboides', 'espalda', 'tiron'),
  ('dorsal ancho', 'espalda', 'tiron'),
  ('erectores espinales', 'espalda_baja_y_core', 'estabilidad'),
  ('cuadrado lumbar', 'espalda_baja_y_core', 'estabilidad'),
  ('recto abdominal', 'core', 'core'),
  ('oblicuos', 'core', 'core'),
  ('aductores', 'piernas', 'aduccion_cadera'),
  ('gluteo mayor', 'piernas', 'extension_cadera'),
  ('gluteo medio', 'piernas', 'abduccion_cadera'),
  ('gluteo menor', 'piernas', 'abduccion_cadera'),
  ('cuadriceps', 'piernas', 'extension_rodilla'),
  ('isquiotibiales', 'piernas', 'flexion_rodilla'),
  ('gemelos', 'piernas', 'flexion_plantar'),
  ('tibial anterior', 'piernas', 'dorsiflexion');

-- 4) Equipment: practical + alternatives coverage.
insert into public.equipment (id, name, progression)
values
  (1,  'peso corporal', 'bodyweight'),
  (2,  'mancuernas', 'free_weight'),
  (3,  'kettlebell', 'free_weight'),
  (4,  'barra olimpica', 'free_weight'),
  (5,  'barra ez', 'free_weight'),
  (6,  'discos', 'free_weight'),
  (7,  'rack/jaula', 'rack'),
  (8,  'multipower', 'machine'),
  (9,  'polea alta', 'cable'),
  (10, 'polea baja', 'cable'),
  (11, 'bandas elasticas', 'bands'),
  (12, 'anillas', 'bodyweight'),
  (13, 'trx', 'bodyweight'),
  (14, 'banco', 'support'),
  (15, 'esterilla', 'support'),
  (16, 'agarre bajo/paralletes', 'accessory'),
  (17, 'agarre de cuello', 'accessory'),
  (18, 'cuerda triceps', 'cable_accessory'),
  (19, 'barra recta de polea', 'cable_accessory'),
  (20, 'barra v/agarre neutro', 'cable_accessory'),
  (21, 'tobilleras lastradas', 'accessory'),
  (22, 'maquina guiada', 'machine'),
  (23, 'barra alta (dominadas)', 'bodyweight'),
  (24, 'barra baja (remo invertido)', 'bodyweight'),
  (25, 'aros de gimnasia', 'bodyweight')
on conflict (id) do update
set name = excluded.name,
    progression = excluded.progression;

delete from public.equipment
where id not in (1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25);

-- Keep current sample exercises compatible with new catalog.
update public.exercises
set equipment_id = 1
where name in ('Pistol Squat', 'Flexiones');

-- 5) Joint mapping by muscle group.
insert into public.muscle_joints (muscle_id, joint_id)
select m.id, j.id
from (
  values
    ('antebrazos', 'munecas'),
    ('antebrazos', 'codos'),
    ('biceps', 'codos'),
    ('biceps', 'hombros'),
    ('triceps', 'codos'),
    ('triceps', 'hombros'),
    ('deltoides anterior', 'hombros'),
    ('deltoides lateral', 'hombros'),
    ('deltoides posterior', 'hombros'),
    ('pectoral', 'hombros'),
    ('trapecio', 'hombros'),
    ('trapecio', 'columna cervical'),
    ('romboides', 'hombros'),
    ('dorsal ancho', 'hombros'),
    ('erectores espinales', 'columna lumbar'),
    ('erectores espinales', 'columna cervical'),
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

-- 6) Re-map current sample exercises to new muscle catalog.
insert into public.exercise_muscles (exercise_id, muscle_id)
select e.id, m.id
from (
  values
    ('Pistol Squat', 'cuadriceps'),
    ('Pistol Squat', 'gluteo mayor'),
    ('Pistol Squat', 'gluteo medio'),
    ('Pistol Squat', 'isquiotibiales'),
    ('Pistol Squat', 'erectores espinales'),
    ('Flexiones', 'pectoral'),
    ('Flexiones', 'triceps'),
    ('Flexiones', 'deltoides anterior')
) as map(exercise_name, muscle_name)
join public.exercises e on e.name = map.exercise_name
join public.muscles m on m.name = map.muscle_name
on conflict do nothing;

-- 7) Derive exercise_joints from exercise_muscles x muscle_joints.
insert into public.exercise_joints (exercise_id, joint_id)
select distinct em.exercise_id, mj.joint_id
from public.exercise_muscles em
join public.muscle_joints mj on mj.muscle_id = em.muscle_id
on conflict do nothing;

-- 8) Avoid future duplicates by normalized names.
create unique index if not exists joints_name_lower_unique_idx
  on public.joints (lower(name));

create unique index if not exists muscles_name_lower_unique_idx
  on public.muscles (lower(name));

create unique index if not exists equipment_name_lower_unique_idx
  on public.equipment (lower(name));
