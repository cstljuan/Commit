-- Apply after Shahd's 0001. RLS helpers intentionally bypass the membership table's own policy.
begin;
create or replace function public.is_team_member(p uuid) returns boolean
language sql security definer stable set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.team_members where project_id = p and user_id = auth.uid() and status = 'active'
  );
$$;
create or replace function public.is_project_owner(p uuid) returns boolean
language sql security definer stable set search_path = '' as $$
  select auth.uid() is not null and exists (select 1 from public.projects where id = p and owner_id = auth.uid());
$$;
revoke all on function public.is_team_member(uuid), public.is_project_owner(uuid) from public, anon;
grant execute on function public.is_team_member(uuid), public.is_project_owner(uuid) to authenticated, service_role;

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_roles enable row level security;
alter table public.swipes enable row level security;
alter table public.matches enable row level security;
alter table public.team_members enable row level security;
alter table public.team_keys enable row level security;
alter table public.messages enable row level security;
alter table public.idea_embeddings enable row level security;
alter table public.copy_alerts enable row level security;
alter table public.post_attempts enable row level security;
alter table public.eval_results enable row level security;
alter table public.redteam_runs enable row level security;

grant select on public.profiles, public.projects, public.project_roles, public.swipes, public.matches,
  public.team_members, public.team_keys, public.messages, public.copy_alerts, public.eval_results, public.redteam_runs to authenticated;
grant insert, update, delete on public.projects, public.project_roles, public.swipes to authenticated;
grant insert on public.team_keys, public.messages to authenticated;
revoke all on public.idea_embeddings, public.post_attempts from anon, authenticated;
revoke insert, update, delete on public.matches, public.team_members, public.copy_alerts, public.eval_results, public.redteam_runs from anon, authenticated;
revoke update, delete on public.team_keys, public.messages from anon, authenticated;

create policy "profiles read" on public.profiles for select to authenticated using (true);
create policy "profiles own insert" on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy "profiles own update" on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
-- F1: a column revoke cannot override a table grant. Protect INSERT as well as UPDATE.
revoke update, insert on public.profiles from anon, authenticated;
grant insert (id, name, avatar_url, bio, skills, hours_per_week, timezone, links, women_only, box_public_key, sign_public_key) on public.profiles to authenticated;
grant update (name, avatar_url, bio, skills, hours_per_week, timezone, links, women_only, box_public_key, sign_public_key) on public.profiles to authenticated;
-- A registered identity cannot be rotated through profile edits and invalidate historical signatures (F11).
create or replace function public.preserve_profile_keys() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (old.box_public_key is not null and new.box_public_key is distinct from old.box_public_key)
     or (old.sign_public_key is not null and new.sign_public_key is distinct from old.sign_public_key) then
    raise exception 'registered device keys cannot be replaced';
  end if;
  return new;
end $$;
create trigger profiles_preserve_keys before update on public.profiles
for each row execute function public.preserve_profile_keys();
revoke all on function public.preserve_profile_keys() from public, anon, authenticated;

create policy "projects read" on public.projects for select to authenticated using (true);
create policy "projects owner write" on public.projects for all to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "roles read" on public.project_roles for select to authenticated using (true);
create policy "roles owner write" on public.project_roles for all to authenticated
  using (public.is_project_owner(project_id)) with check (public.is_project_owner(project_id));
create policy "own swipes" on public.swipes for all to authenticated
  using ((select auth.uid()) = swiper_id) with check (
    (select auth.uid()) = swiper_id and project_id is not null
    and (target_type = 'project' or (target_type = 'person' and public.is_project_owner(project_id)))
  );
create policy "matches read" on public.matches for select to authenticated
  using ((select auth.uid()) = user_id or public.is_project_owner(project_id));
create policy "team read" on public.team_members for select to authenticated using (public.is_team_member(project_id));
create policy "team keys own" on public.team_keys for select to authenticated using ((select auth.uid()) = user_id);
create policy "team keys owner insert" on public.team_keys for insert to authenticated with check (
  public.is_project_owner(project_id)
  and (user_id = (select auth.uid()) or exists (
    select 1 from public.team_members tm where tm.project_id = team_keys.project_id and tm.user_id = team_keys.user_id and tm.status = 'active'
  ))
  and sender_public_key = (select box_public_key from public.profiles where id = (select auth.uid()))
);
create policy "messages team" on public.messages for select to authenticated using (public.is_team_member(project_id));
create policy "messages team insert" on public.messages for insert to authenticated
  with check (public.is_team_member(project_id) and sender_id = (select auth.uid()));
create policy "alerts own" on public.copy_alerts for select to authenticated using ((select auth.uid()) = owner_id);
create policy "eval read" on public.eval_results for select to authenticated using (true);
create policy "redteam read" on public.redteam_runs for select to authenticated using (true);
create index if not exists team_members_user_project on public.team_members (user_id, project_id);
create index if not exists messages_project on public.messages (project_id);
commit;
