-- Training zone cleanup + hardening for beta workout tracking

-- 1) Normalize and deduplicate muscle catalog by name (case-insensitive).
with normalized as (
  select id, lower(trim(name)) as norm_name
  from public.muscles
), canonical as (
  select norm_name, min(id) as keep_id
  from normalized
  group by norm_name
), remap as (
  select n.id as old_id, c.keep_id
  from normalized n
  join canonical c on c.norm_name = n.norm_name
  where n.id <> c.keep_id
)
insert into public.exercise_muscles (exercise_id, muscle_id)
select em.exercise_id, r.keep_id
from public.exercise_muscles em
join remap r on r.old_id = em.muscle_id
on conflict (exercise_id, muscle_id) do nothing;

with normalized as (
  select id, lower(trim(name)) as norm_name
  from public.muscles
), canonical as (
  select norm_name, min(id) as keep_id
  from normalized
  group by norm_name
), remap as (
  select n.id as old_id, c.keep_id
  from normalized n
  join canonical c on c.norm_name = n.norm_name
  where n.id <> c.keep_id
)
delete from public.exercise_muscles em
using remap r
where em.muscle_id = r.old_id;

with normalized as (
  select id, lower(trim(name)) as norm_name
  from public.muscles
), canonical as (
  select norm_name, min(id) as keep_id
  from normalized
  group by norm_name
), remap as (
  select n.id as old_id, c.keep_id
  from normalized n
  join canonical c on c.norm_name = n.norm_name
  where n.id <> c.keep_id
)
update public.muscle_joints mj
set muscle_id = r.keep_id
from remap r
where mj.muscle_id = r.old_id;

with normalized as (
  select id, lower(trim(name)) as norm_name
  from public.muscles
), canonical as (
  select norm_name, min(id) as keep_id
  from normalized
  group by norm_name
), to_delete as (
  select n.id
  from normalized n
  join canonical c on c.norm_name = n.norm_name
  where n.id <> c.keep_id
)
delete from public.muscles m
using to_delete d
where m.id = d.id;

-- 2) Align types and enforce structural integrity in muscle_joints.
alter table public.muscle_joints
  alter column muscle_id type bigint using muscle_id::bigint,
  alter column joint_id type bigint using joint_id::bigint;

-- Remove duplicated pairs before adding uniqueness.
delete from public.muscle_joints a
using public.muscle_joints b
where a.id > b.id
  and a.muscle_id = b.muscle_id
  and a.joint_id = b.joint_id;

alter table public.muscle_joints
  alter column muscle_id set not null,
  alter column joint_id set not null;

-- 3) Fill missing exercise_joints from exercise_muscles x muscle_joints.
insert into public.exercise_joints (exercise_id, joint_id)
select distinct em.exercise_id, mj.joint_id
from public.exercise_muscles em
join public.muscle_joints mj on mj.muscle_id = em.muscle_id
left join public.exercise_joints ej
  on ej.exercise_id = em.exercise_id
 and ej.joint_id = mj.joint_id
where ej.exercise_id is null;

-- 4) Data checks and minimal non-null hardening for key catalog fields.
alter table public.equipment alter column name set not null;
alter table public.joints alter column name set not null;
alter table public.muscles alter column name set not null;
alter table public.exercises alter column name set not null;

-- 5) Performance indexes for FK-driven joins.
create index if not exists exercise_joints_joint_id_idx
  on public.exercise_joints (joint_id);

create index if not exists exercise_muscles_muscle_id_idx
  on public.exercise_muscles (muscle_id);

create index if not exists muscle_joints_joint_id_idx
  on public.muscle_joints (joint_id);

create index if not exists mesocycles_user_id_idx
  on public.mesocycles (user_id);

create index if not exists routines_user_id_idx
  on public.routines (user_id);

create index if not exists routines_mesocycle_id_idx
  on public.routines (mesocycle_id);

create index if not exists workouts_user_id_idx
  on public.workouts (user_id);

create index if not exists workouts_routine_id_idx
  on public.workouts (routine_id);

create index if not exists workout_exercises_workout_id_idx
  on public.workout_exercises (workout_id);

create index if not exists workout_exercises_exercise_id_idx
  on public.workout_exercises (exercise_id);

create index if not exists exercise_sets_workout_exercise_id_idx
  on public.exercise_sets (workout_exercise_id);

-- 6) Guardrails for workout tracking values.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'muscle_joints_muscle_joint_unique'
      and conrelid = 'public.muscle_joints'::regclass
  ) then
    alter table public.muscle_joints
      add constraint muscle_joints_muscle_joint_unique unique (muscle_id, joint_id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'routines_day_of_week_check'
      and conrelid = 'public.routines'::regclass
  ) then
    alter table public.routines
      add constraint routines_day_of_week_check
      check (day_of_week is null or day_of_week between 1 and 7);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'workout_exercises_sequence_check'
      and conrelid = 'public.workout_exercises'::regclass
  ) then
    alter table public.workout_exercises
      add constraint workout_exercises_sequence_check
      check (sequence is null or sequence >= 1);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'exercise_sets_set_no_check'
      and conrelid = 'public.exercise_sets'::regclass
  ) then
    alter table public.exercise_sets
      add constraint exercise_sets_set_no_check
      check (set_no is null or set_no >= 1);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'exercise_sets_reps_check'
      and conrelid = 'public.exercise_sets'::regclass
  ) then
    alter table public.exercise_sets
      add constraint exercise_sets_reps_check
      check (reps is null or reps >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'exercise_sets_weight_check'
      and conrelid = 'public.exercise_sets'::regclass
  ) then
    alter table public.exercise_sets
      add constraint exercise_sets_weight_check
      check (weight is null or weight >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'exercise_sets_rir_check'
      and conrelid = 'public.exercise_sets'::regclass
  ) then
    alter table public.exercise_sets
      add constraint exercise_sets_rir_check
      check (rir is null or rir between 0 and 10);
  end if;
end
$$;

-- 7) RLS: make workout tracking usable for users/admin and readable for coaches.
drop policy if exists "Allow admin full access on workouts" on public.workouts;
create policy "Allow admin full access on workouts"
on public.workouts
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

drop policy if exists "Allow users to access their own workouts" on public.workouts;
create policy "Allow users to access their own workouts"
on public.workouts
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

alter table public.workout_exercises enable row level security;
alter table public.exercise_sets enable row level security;

drop policy if exists "Allow admin full access on workout_exercises" on public.workout_exercises;
create policy "Allow admin full access on workout_exercises"
on public.workout_exercises
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

drop policy if exists "Allow users to manage their own workout_exercises" on public.workout_exercises;
create policy "Allow users to manage their own workout_exercises"
on public.workout_exercises
for all
using (
  exists (
    select 1
    from public.workouts w
    where w.id = workout_exercises.workout_id
      and w.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.workouts w
    where w.id = workout_exercises.workout_id
      and w.user_id = auth.uid()
  )
);

drop policy if exists "Coaches can view their clients workout_exercises" on public.workout_exercises;
create policy "Coaches can view their clients workout_exercises"
on public.workout_exercises
for select
using (
  exists (
    select 1
    from public.workouts w
    join public.coach_clients cc on cc.client_id = w.user_id
    where w.id = workout_exercises.workout_id
      and cc.coach_id = auth.uid()
  )
);

drop policy if exists "Allow admin full access on exercise_sets" on public.exercise_sets;
create policy "Allow admin full access on exercise_sets"
on public.exercise_sets
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

drop policy if exists "Allow users to manage their own exercise_sets" on public.exercise_sets;
create policy "Allow users to manage their own exercise_sets"
on public.exercise_sets
for all
using (
  exists (
    select 1
    from public.workout_exercises we
    join public.workouts w on w.id = we.workout_id
    where we.id = exercise_sets.workout_exercise_id
      and w.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.workout_exercises we
    join public.workouts w on w.id = we.workout_id
    where we.id = exercise_sets.workout_exercise_id
      and w.user_id = auth.uid()
  )
);

drop policy if exists "Coaches can view their clients exercise_sets" on public.exercise_sets;
create policy "Coaches can view their clients exercise_sets"
on public.exercise_sets
for select
using (
  exists (
    select 1
    from public.workout_exercises we
    join public.workouts w on w.id = we.workout_id
    join public.coach_clients cc on cc.client_id = w.user_id
    where we.id = exercise_sets.workout_exercise_id
      and cc.coach_id = auth.uid()
  )
);
