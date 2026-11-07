-- Apply only after Shahd's 0004_modes_and_fun.sql.
begin;
alter table public.match_messages enable row level security;
revoke all on public.match_messages from anon, authenticated;
grant select, insert on public.match_messages to authenticated;
create policy "match messages read" on public.match_messages for select to authenticated using (
  exists(select 1 from public.matches m where m.id = match_id and (m.user_id = (select auth.uid()) or public.is_project_owner(m.project_id)))
);
create policy "match messages insert" on public.match_messages for insert to authenticated with check (
  sender_id = (select auth.uid()) and exists(
    select 1 from public.matches m where m.id = match_id and (m.user_id = (select auth.uid()) or public.is_project_owner(m.project_id))
  )
);
create index if not exists match_messages_match on public.match_messages(match_id);
grant update (username, primary_role, level, occupation, prompts) on public.profiles to authenticated;
grant insert (username, primary_role, level, occupation, prompts) on public.profiles to authenticated;

-- F6: look up the caller through a definer helper to avoid profiles-policy recursion.
create or replace function public.is_women_member() returns boolean
language sql security definer stable set search_path = '' as $$
  select auth.uid() is not null and exists(select 1 from public.profiles where id = auth.uid() and women_only is true);
$$;
revoke all on function public.is_women_member() from public, anon;
grant execute on function public.is_women_member() to authenticated;
-- Restrictive policies compose with owner policies instead of being bypassed by their OR.
create policy "women profiles visibility" on public.profiles as restrictive for select to authenticated
  using (id = (select auth.uid()) or not coalesce(women_only, false) or public.is_women_member());
create policy "women projects visibility" on public.projects as restrictive for select to authenticated
  using (owner_id = (select auth.uid()) or not coalesce(women_only, false) or public.is_women_member());
commit;
