-- Allow routine exercises to be tied to a specific day block (torso/cardio/movilidad...)

alter table public.routine_exercises
  add column if not exists routine_day_block_id bigint references public.routine_day_blocks(id) on delete set null;

create index if not exists routine_exercises_routine_day_block_idx
  on public.routine_exercises (routine_day_block_id);

create or replace function public.validate_routine_exercise_day_block()
returns trigger
language plpgsql
as $$
declare
  v_block_routine_id bigint;
begin
  if new.routine_day_block_id is null then
    return new;
  end if;

  select routine_id
  into v_block_routine_id
  from public.routine_day_blocks
  where id = new.routine_day_block_id;

  if v_block_routine_id is null then
    raise exception 'routine_day_block_id % not found', new.routine_day_block_id;
  end if;

  if new.routine_id is not null and v_block_routine_id <> new.routine_id then
    raise exception 'routine_day_block_id % does not belong to routine_id %', new.routine_day_block_id, new.routine_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_routine_exercise_day_block on public.routine_exercises;
create trigger trg_validate_routine_exercise_day_block
before insert or update of routine_id, routine_day_block_id
on public.routine_exercises
for each row
execute function public.validate_routine_exercise_day_block();
