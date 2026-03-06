alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists avatar_url text;

update public.profiles
set
  first_name = coalesce(
    first_name,
    nullif(split_part(trim(full_name), ' ', 1), '')
  ),
  last_name = coalesce(
    last_name,
    nullif(trim(regexp_replace(trim(full_name), '^[^ ]+\s*', '')), '')
  )
where full_name is not null;

update public.profiles
set full_name = nullif(trim(concat_ws(' ', first_name, last_name)), '')
where full_name is null
  and (first_name is not null or last_name is not null);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-images',
  'profile-images',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Allow authenticated users upload profile images'
  ) then
    create policy "Allow authenticated users upload profile images"
      on storage.objects
      as permissive
      for insert
      to authenticated
      with check (bucket_id = 'profile-images');
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Allow public read profile images'
  ) then
    create policy "Allow public read profile images"
      on storage.objects
      as permissive
      for select
      to public
      using (bucket_id = 'profile-images');
  end if;
end
$$;

