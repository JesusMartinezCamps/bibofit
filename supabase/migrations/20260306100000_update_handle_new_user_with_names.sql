create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, first_name, last_name, full_name, email)
  values (
    new.id,
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name',
    new.raw_user_meta_data->>'full_name',
    new.email
  )
  on conflict (user_id) do update
  set email = excluded.email;

  insert into public.user_roles (user_id, role_id)
  values (new.id, (select id from public.roles where role = 'free'))
  on conflict (user_id) do nothing;

  return new;
end;
$$;
