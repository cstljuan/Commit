-- 0007_copy_alerts.sql (shahd-agent). F12: one copy alert per copier per original.
-- copier_id is written only by the post_idea functions (service role) and is never readable by clients,
-- so an owner learns that someone posted a close copy, never who.
begin;
alter table public.copy_alerts add column copier_id uuid references public.profiles(id) on delete cascade;
create unique index copy_alerts_one_per_copier on public.copy_alerts (original_project_id, copier_id);

revoke select on public.copy_alerts from anon, authenticated;
grant select (id, owner_id, original_project_id, similarity, created_at) on public.copy_alerts to authenticated;
commit;
