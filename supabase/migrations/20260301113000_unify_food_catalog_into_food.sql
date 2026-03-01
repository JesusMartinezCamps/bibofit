begin;

-- 1) Extend canonical food catalog with moderation/audit metadata.
alter table public.food
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now(),
  add column if not exists visibility text default 'global',
  add column if not exists moderation_status text default 'approved',
  add column if not exists approved_by uuid,
  add column if not exists approved_at timestamptz,
  add column if not exists rejected_at timestamptz,
  add column if not exists rejection_reason text,
  add column if not exists source_user_created_food_id bigint;

create index if not exists idx_food_user_id on public.food(user_id);
create index if not exists idx_food_status on public.food(status);
create index if not exists idx_food_source_user_created_food_id on public.food(source_user_created_food_id);

-- 2) Backfill canonical metadata for already existing food rows.
update public.food f
set
  visibility = coalesce(
    f.visibility,
    case when f.user_id is null then 'global' else 'private' end
  ),
  moderation_status = coalesce(
    f.moderation_status,
    case
      when coalesce(f.status, '') in ('pending') then 'pending'
      when coalesce(f.status, '') in ('rejected') then 'rejected'
      else 'approved'
    end
  ),
  approved_at = coalesce(
    f.approved_at,
    case
      when coalesce(f.status, '') in ('approved_general', 'approved_private') then now()
      else null
    end
  );

-- 3) Map legacy user_created_foods already linked to a food row.
update public.food f
set
  source_user_created_food_id = coalesce(f.source_user_created_food_id, u.id),
  user_id = coalesce(f.user_id, u.user_id),
  status = coalesce(nullif(f.status, ''), u.status),
  visibility = coalesce(
    f.visibility,
    case when u.status = 'approved_general' then 'global' else 'private' end
  ),
  moderation_status = coalesce(
    f.moderation_status,
    case
      when u.status = 'pending' then 'pending'
      when u.status = 'rejected' then 'rejected'
      else 'approved'
    end
  ),
  created_at = coalesce(f.created_at, u.created_at, now())
from public.user_created_foods u
where u.linked_food_id = f.id;

-- 4) Create food rows for legacy user_created_foods not linked yet.
insert into public.food (
  name,
  food_unit,
  user_id,
  proteins,
  total_carbs,
  total_fats,
  food_url,
  status,
  source_user_created_food_id,
  created_at,
  visibility,
  moderation_status
)
select
  u.name,
  coalesce(u.food_unit, 'gramos'),
  u.user_id,
  u.proteins,
  u.total_carbs,
  u.total_fats,
  u.food_url,
  u.status,
  u.id,
  coalesce(u.created_at, now()),
  case when u.status = 'approved_general' then 'global' else 'private' end,
  case
    when u.status = 'pending' then 'pending'
    when u.status = 'rejected' then 'rejected'
    else 'approved'
  end
from public.user_created_foods u
where u.linked_food_id is null
  and not exists (
    select 1
    from public.food f
    where f.source_user_created_food_id = u.id
  );

-- Keep legacy linkage aligned for compatibility while old code is removed.
update public.user_created_foods u
set linked_food_id = f.id
from public.food f
where f.source_user_created_food_id = u.id
  and (u.linked_food_id is distinct from f.id);

-- 5) Migrate legacy relation tables to canonical food_* relation tables.
insert into public.food_to_food_groups (food_id, food_group_id)
select distinct f.id, r.food_group_id
from public.user_created_food_to_food_groups r
join public.food f on f.source_user_created_food_id = r.user_created_food_id
where not exists (
  select 1 from public.food_to_food_groups fg
  where fg.food_id = f.id and fg.food_group_id = r.food_group_id
);

insert into public.food_sensitivities (food_id, sensitivity_id)
select distinct f.id, r.sensitivity_id
from public.user_created_food_sensitivities r
join public.food f on f.source_user_created_food_id = r.user_created_food_id
where not exists (
  select 1 from public.food_sensitivities fs
  where fs.food_id = f.id and fs.sensitivity_id = r.sensitivity_id
);

insert into public.food_vitamins (food_id, vitamin_id, mg_per_100g)
select distinct f.id, r.vitamin_id, r.mg_per_100g
from public.user_created_food_vitamins r
join public.food f on f.source_user_created_food_id = r.user_created_food_id
where not exists (
  select 1 from public.food_vitamins fv
  where fv.food_id = f.id and fv.vitamin_id = r.vitamin_id
);

insert into public.food_minerals (food_id, mineral_id, mg_per_100g)
select distinct f.id, r.mineral_id, r.mg_per_100g
from public.user_created_food_minerals r
join public.food f on f.source_user_created_food_id = r.user_created_food_id
where not exists (
  select 1 from public.food_minerals fm
  where fm.food_id = f.id and fm.mineral_id = r.mineral_id
);

insert into public.food_to_stores (food_id, store_id)
select distinct f.id, u.store_id
from public.user_created_foods u
join public.food f on f.source_user_created_food_id = u.id
where u.store_id is not null
  and not exists (
    select 1 from public.food_to_stores fs
    where fs.food_id = f.id and fs.store_id = u.store_id
  );

-- 6) Migrate ingredient references to canonical food_id.
update public.free_recipe_ingredients fri
set food_id = f.id
from public.food f
where fri.user_created_food_id = f.source_user_created_food_id
  and fri.food_id is null;

update public.snack_ingredients si
set food_id = f.id
from public.food f
where si.user_created_food_id = f.source_user_created_food_id
  and si.food_id is null;

-- 7) Remove dual-source ingredient references now that food is canonical.
alter table public.free_recipe_ingredients
  drop constraint if exists free_recipe_ingredients_user_created_food_id_fkey;
alter table public.snack_ingredients
  drop constraint if exists snack_ingredients_user_created_food_id_fkey;

alter table public.free_recipe_ingredients
  drop column if exists user_created_food_id;
alter table public.snack_ingredients
  drop column if exists user_created_food_id;

commit;
