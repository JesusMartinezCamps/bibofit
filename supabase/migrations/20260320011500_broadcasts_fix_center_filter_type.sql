-- Fix legacy center filter type in broadcasts.
-- Some environments may have filter_center_ids as uuid[] from early drafts,
-- while user_centers.center_id and centers.id are bigint.

do $$
declare
  v_udt_name text;
begin
  select c.udt_name
  into v_udt_name
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'broadcasts'
    and c.column_name = 'filter_center_ids';

  if v_udt_name = '_uuid' then
    -- No safe cast uuid[] -> bigint[] in current model; reset previous values.
    update public.broadcasts
    set filter_center_ids = null
    where filter_center_ids is not null;

    alter table public.broadcasts
      alter column filter_center_ids type bigint[]
      using null::bigint[];
  end if;
end
$$;
