alter table public.profiles
  add column if not exists preferred_theme text;

alter table public.profiles
  drop constraint if exists profiles_preferred_theme_check;

alter table public.profiles
  add constraint profiles_preferred_theme_check
  check (preferred_theme in ('light', 'dark'));

update public.profiles
set preferred_theme = 'light'
where preferred_theme is null;
