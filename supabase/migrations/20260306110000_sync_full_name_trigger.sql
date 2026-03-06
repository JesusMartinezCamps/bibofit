-- Función que mantiene full_name sincronizado con first_name + last_name
create or replace function public.sync_full_name()
returns trigger
language plpgsql
as $$
begin
  new.full_name := nullif(trim(concat_ws(' ', new.first_name, new.last_name)), '');
  return new;
end;
$$;

-- Trigger que la ejecuta en cada insert/update que toque nombre o apellidos
create trigger sync_full_name_trigger
before insert or update of first_name, last_name
on public.profiles
for each row
execute function public.sync_full_name();
