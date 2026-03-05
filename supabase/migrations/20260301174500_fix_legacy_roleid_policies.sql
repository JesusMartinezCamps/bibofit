-- Replace legacy policies that relied on role_id = 1 with role-name aware/admin helper logic.

drop policy if exists "User or admin can delete conditions" on public.user_medical_conditions;
drop policy if exists "User or admin can insert conditions" on public.user_medical_conditions;
drop policy if exists "User or admin can update conditions" on public.user_medical_conditions;
create policy "User or admin can delete conditions"
on public.user_medical_conditions
for delete
to authenticated
using ((user_id = auth.uid()) or public.is_admin());
create policy "User or admin can insert conditions"
on public.user_medical_conditions
for insert
to authenticated
with check ((user_id = auth.uid()) or public.is_admin());
create policy "User or admin can update conditions"
on public.user_medical_conditions
for update
to authenticated
using ((user_id = auth.uid()) or public.is_admin())
with check ((user_id = auth.uid()) or public.is_admin());
