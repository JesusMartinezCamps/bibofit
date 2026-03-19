-- Backfill after Notion import: ensure places and core muscle mappings for incomplete rows.

-- 1) Any Notion-imported exercise without place gets default place = gym.
insert into public.exercise_places (exercise_id, place_id)
select e.id, p.id
from public.exercises e
join public.training_places p on p.name = 'gym'
where e.technique like 'Notion import%'
  and not exists (
    select 1 from public.exercise_places ep where ep.exercise_id = e.id
  )
on conflict do nothing;

-- 2) Backfill missing muscles for specific imported exercises.
create temporary table tmp_backfill_exercise_muscles (
  exercise_name text,
  muscle_name text
) on commit drop;

insert into tmp_backfill_exercise_muscles (exercise_name, muscle_name)
values
  ('Contractora de Pectoral en Máquina', 'pectoral'),
  ('Contractora de Pectoral en Máquina', 'deltoides anterior'),
  ('Contractora de Pectoral en Máquina', 'triceps'),
  ('Curl Femoral Sentado', 'isquiotibiales'),
  ('Curl Femoral Sentado', 'gemelos'),
  ('Curl Femoral Tumbado', 'isquiotibiales'),
  ('Curl Femoral Tumbado', 'gemelos'),
  ('Extensión de Cuádriceps', 'cuadriceps'),
  ('Movilidad de piernas', 'aductores'),
  ('Movilidad de piernas', 'gluteo medio'),
  ('Movilidad de piernas', 'isquiotibiales'),
  ('Zancadas', 'cuadriceps'),
  ('Zancadas', 'gluteo mayor'),
  ('Zancadas', 'isquiotibiales'),
  ('Zancadas', 'aductores'),
  ('Zancadas', 'gemelos'),
  ('Zancadas Búlgaras', 'cuadriceps'),
  ('Zancadas Búlgaras', 'gluteo mayor'),
  ('Zancadas Búlgaras', 'isquiotibiales'),
  ('Zancadas Búlgaras', 'aductores'),
  ('Zancadas Búlgaras', 'gemelos');

insert into public.exercise_muscles (exercise_id, muscle_id)
select e.id, m.id
from tmp_backfill_exercise_muscles b
join public.exercises e on lower(e.name) = lower(b.exercise_name)
join public.muscles m on lower(m.name) = lower(b.muscle_name)
on conflict do nothing;

-- 3) Ensure joints exist for those muscle backfills.
insert into public.exercise_joints (exercise_id, joint_id)
select distinct e.id, mj.joint_id
from tmp_backfill_exercise_muscles b
join public.exercises e on lower(e.name) = lower(b.exercise_name)
join public.exercise_muscles em on em.exercise_id = e.id
join public.muscle_joints mj on mj.muscle_id = em.muscle_id
on conflict do nothing;
