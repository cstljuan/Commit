-- 0009_rls_hardening.sql (shahd-agent, W2). Fixes from the authenticated red team (scripts/redteam/authed-probe.mts).
-- Every item was proven live as qa_mallory before this migration and re-checked after it.
begin;

-- ---------- 1. Women mode is server-set only ----------
-- Any user could set profiles.women_only on themselves and then read Women profiles and decks.
-- The flag is now written only by the service role (seed, or the team granting access for the demo).
-- Self-identification is not verified, so there is deliberately no self-serve RPC either.
-- The column grants stay so the deployed app's saveProfile (which still sends women_only) keeps working:
-- a trigger silently pins the value for client roles instead of rejecting the whole upsert.
grant insert (women_only), update (women_only) on public.profiles to authenticated;
create or replace function public.lock_women_only() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.women_only := false;
    else
      new.women_only := old.women_only;
    end if;
  end if;
  return new;
end $$;
revoke all on function public.lock_women_only() from public, anon, authenticated;
drop trigger if exists profiles_lock_women_only on public.profiles;
create trigger profiles_lock_women_only before insert or update on public.profiles
for each row execute function public.lock_women_only();
-- PostgREST upserts write "set id = excluded.id", so saveProfile needs update on id. The policy
-- (using and with check: id = auth.uid()) keeps id unchangeable.
grant update (id) on public.profiles to authenticated;

-- A women_only project must belong to a Women mode account, or anyone could reach Women decks with one.
create or replace function public.enforce_women_project() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(new.women_only, false) and not exists (
    select 1 from public.profiles where id = new.owner_id and women_only is true
  ) then
    raise exception 'women only projects need a Women mode account';
  end if;
  return new;
end $$;
revoke all on function public.enforce_women_project() from public, anon, authenticated;
drop trigger if exists projects_women_owner on public.projects;
create trigger projects_women_owner before insert or update of women_only, owner_id on public.projects
for each row execute function public.enforce_women_project();

-- ---------- 2. Vault timestamps cannot be backdated or postdated ----------
-- Same signature, grants and advisory lock as 0003. New: p_ts must be within now() - 5 min .. now() + 1 min,
-- and not older than the newest entry already in the chain.
create or replace function public.append_vault_entry(p_project uuid, p_idea_hash text, p_ts timestamptz, p_sig text)
returns public.vault_log language plpgsql security definer set search_path = '' as $$
declare v_prev text; v_row public.vault_log; v_content text; v_head_ts timestamptz;
begin
  if auth.uid() is null or not public.is_project_owner(p_project) then raise exception 'not owner'; end if;
  if p_idea_hash is null or p_idea_hash !~ '^[0-9a-f]{64}$' or p_ts is null or not isfinite(p_ts)
     or p_sig is null or p_sig !~ '^[A-Za-z0-9+/]{86}==$' then raise exception 'invalid vault content'; end if;
  if p_ts < now() - interval '5 minutes' or p_ts > now() + interval '1 minute' then
    raise exception 'vault timestamp out of range';
  end if;
  if not exists (select 1 from public.profiles where id = auth.uid() and sign_public_key is not null) then
    raise exception 'register signing keys first';
  end if;
  perform pg_advisory_xact_lock(42);
  -- Lock the project against concurrent deletion for the duration of the append.
  perform 1 from public.projects where id = p_project and owner_id = auth.uid() for key share;
  select entry_hash, ts into v_prev, v_head_ts from public.vault_log order by seq desc limit 1;
  if v_head_ts is not null and p_ts < v_head_ts then raise exception 'vault timestamp older than the chain head'; end if;
  v_prev := coalesce(v_prev, repeat('0', 64));
  v_content := p_project::text || '|' || auth.uid()::text || '|' || p_idea_hash || '|' ||
    to_char(p_ts at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  insert into public.vault_log(project_id, author_id, idea_hash, ts, author_sig, prev_hash, entry_hash)
  values(p_project, auth.uid(), p_idea_hash, p_ts, p_sig, v_prev,
    encode(sha256(convert_to(v_content || '|' || v_prev, 'UTF8')), 'hex')) returning * into v_row;
  return v_row;
end $$;
revoke all on function public.append_vault_entry(uuid, text, timestamptz, text) from public, anon, service_role;
grant execute on function public.append_vault_entry(uuid, text, timestamptz, text) to authenticated;

-- ---------- 3. Ciphertext and hidden projects ----------
-- Column grants: everything except idea_cipher and idea_nonce. Cards come from get_deck (security definer).
-- New projects columns must be added here to be readable by the app.
revoke select on public.projects from anon, authenticated;
grant select (id, owner_id, title, short_pitch, type, field, hours_per_week, women_only, created_at,
  visibility, theme, github_url, timeframe, idea_public, hidden, completed_at) on public.projects to authenticated;

-- Members and the owner read the stored idea here. idea_public only for public projects.
create or replace function public.project_idea(p uuid) returns table(idea_cipher text, idea_nonce text, idea_public text)
language sql stable security definer set search_path = '' as $$
  select idea_cipher, idea_nonce, case when visibility = 'public' then idea_public end
  from public.projects where id = p and (public.is_team_member(p) or public.is_project_owner(p));
$$;
revoke all on function public.project_idea(uuid) from public, anon;
grant execute on function public.project_idea(uuid) to authenticated;

-- Hidden rows (hack team shells, attack junk) only for the owner, members, and people matched on them.
drop policy if exists "hidden projects visibility" on public.projects;
create policy "hidden projects visibility" on public.projects as restrictive for select to authenticated
  using (hidden is not true or owner_id = (select auth.uid()) or public.is_team_member(id)
    or exists (select 1 from public.matches m where m.project_id = projects.id and m.user_id = (select auth.uid())));

-- Split "owner write" (FOR ALL) so SELECT has one permissive policy (advisor perf warning). Same rules.
drop policy if exists "projects owner write" on public.projects;
create policy "projects owner insert" on public.projects for insert to authenticated
  with check ((select auth.uid()) = owner_id);
create policy "projects owner update" on public.projects for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "projects owner delete" on public.projects for delete to authenticated
  using ((select auth.uid()) = owner_id);
drop policy if exists "roles owner write" on public.project_roles;
create policy "roles owner insert" on public.project_roles for insert to authenticated
  with check (public.is_project_owner(project_id));
create policy "roles owner update" on public.project_roles for update to authenticated
  using (public.is_project_owner(project_id)) with check (public.is_project_owner(project_id));
create policy "roles owner delete" on public.project_roles for delete to authenticated
  using (public.is_project_owner(project_id));

-- ---------- 4. Swipes only through record_swipe / undo_last_swipe / respond_interested ----------
revoke insert, update, delete on public.swipes from anon, authenticated;

-- ---------- chat body size ----------
alter table public.match_messages add constraint match_messages_body_length check (length(body) <= 12000);

-- ---------- advisor: match_projects with a fixed search_path (F2 grants unchanged) ----------
create or replace function public.match_projects(query_embedding public.vector(384), match_threshold float, match_count int)
returns table (project_id uuid, owner_id uuid, similarity float)
language sql stable set search_path = '' as $$
  select e.project_id, p.owner_id, 1 - (e.embedding operator(public.<=>) query_embedding) as similarity
  from public.idea_embeddings e join public.projects p on p.id = e.project_id
  where 1 - (e.embedding operator(public.<=>) query_embedding) > match_threshold
  order by e.embedding operator(public.<=>) query_embedding
  limit match_count;
$$;
revoke execute on function public.match_projects(public.vector, float, int) from public, anon, authenticated;
grant execute on function public.match_projects(public.vector, float, int) to service_role;

-- ---------- 7. Defense in depth: anon gets nothing in public ----------
-- The app reads no data while signed out. RLS already returned nothing to anon; now the grants agree.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and pg_get_userbyid(p.proowner) = current_user
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  loop
    execute format('revoke all on function %s from anon', r.sig);
  end loop;
end $$;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke all on functions from anon;

commit;
