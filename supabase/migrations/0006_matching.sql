-- 0006_matching.sql (shahd-agent). Swiping, matching, committing, decks, reliability.
-- All client entry points are SECURITY DEFINER with an empty search_path, so the logic lives in one place
-- and clients never write swipes, matches or team_members directly for these flows.
-- Covers handoff 7.2 plus F4 (owner check, slot lock), F5 (no identity in interested), F6 (server-side deck).
begin;

-- ---------- helpers ----------

-- Skills are stored either as ["TypeScript"] or as [{"skill":"Backend","level":"..."}]. Return plain names.
create or replace function public.skill_names(p jsonb) returns text[]
language sql immutable set search_path = '' as $$
  select coalesce(array_agg(case when jsonb_typeof(e) = 'object' then e->>'skill' else e #>> '{}' end), '{}')
  from jsonb_array_elements(coalesce(p, '[]'::jsonb)) e;
$$;

-- Short public commit hash for a project: latest vault entry if any, otherwise derived from the id.
create or replace function public.project_commit_hash(p uuid) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select left(v.entry_hash, 7) from public.vault_log v where v.project_id = p order by v.seq desc limit 1),
    left(md5(p::text), 7));
$$;

create or replace function public.project_role_counts(p uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'role', r.role,
    'open', r.slots_open,
    'filled', (select count(*) from public.team_members tm
               where tm.project_id = p and tm.role = r.role and tm.status = 'active' and tm.ownership <> 'owner'))
    order by r.role), '[]'::jsonb)
  from public.project_roles r where r.project_id = p;
$$;

-- ---------- hack teams ----------

-- Creates (once) the caller's hidden hackathon shell project. Optional p_roles replaces roles needed:
-- [{"role":"Backend","open":2}, ...]
create or replace function public.ensure_hack_team(p_roles jsonb default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_pid uuid; v_name text; r jsonb;
begin
  if v_uid is null then raise exception 'not signed in'; end if;
  select id into v_pid from public.projects
    where owner_id = v_uid and type = 'hackathon' and hidden is true order by created_at limit 1;
  if v_pid is null then
    select coalesce(username, name) into v_name from public.profiles where id = v_uid;
    if v_name is null then raise exception 'create a profile first'; end if;
    insert into public.projects(owner_id, title, short_pitch, type, hidden, visibility)
      values (v_uid, v_name || '''s hack team', '', 'hackathon', true, 'private') returning id into v_pid;
    insert into public.team_members(project_id, user_id, role, ownership)
      select v_pid, v_uid, coalesce(primary_role, 'Backend'), 'owner' from public.profiles where id = v_uid;
  end if;
  if p_roles is not null then
    delete from public.project_roles where project_id = v_pid;
    for r in select * from jsonb_array_elements(p_roles) loop
      insert into public.project_roles(project_id, role, slots_open)
        values (v_pid, r->>'role', greatest(0, coalesce((r->>'open')::int, 1)));
    end loop;
  end if;
  return v_pid;
end $$;

-- ---------- swiping ----------

create or replace function public.super_commits_left() returns int
language sql stable security definer set search_path = '' as $$
  select greatest(0, 1 - count(*))::int from public.swipes
  where swiper_id = auth.uid() and is_super is true and created_at >= date_trunc('day', now());
$$;

-- direction: 'left' | 'right' | 'super'. Returns { matched, matchId }.
-- Project card: p_target_id = project id, p_project_id = same project, caller is the applicant.
-- Person card: caller must own p_project_id (their project, or their hack shell) (F4).
create or replace function public.record_swipe(
  p_target_id uuid, p_target_type text, p_project_id uuid, p_role text, p_direction text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_super boolean := p_direction = 'super';
  v_dir text := case when p_direction = 'left' then 'left' else 'right' end;
  v_owner uuid; v_rev public.swipes; v_match_project uuid; v_match_user uuid; v_role text; v_match_id uuid;
begin
  if v_uid is null then raise exception 'not signed in'; end if;
  if p_direction not in ('left','right','super') then raise exception 'bad direction'; end if;
  if p_target_type not in ('person','project') then raise exception 'bad target type'; end if;
  if p_project_id is null then raise exception 'project required'; end if;

  if p_target_type = 'project' then
    if p_target_id <> p_project_id then raise exception 'project card must target its own project'; end if;
    select owner_id into v_owner from public.projects where id = p_project_id;
    if v_owner is null then raise exception 'project not found'; end if;
    if v_owner = v_uid then raise exception 'cannot swipe on your own project'; end if;
  else
    if p_target_id = v_uid then raise exception 'cannot swipe on yourself'; end if;
    if not exists (select 1 from public.projects where id = p_project_id and owner_id = v_uid) then
      raise exception 'not owner'; -- F4: no faking an owner swipe
    end if;
  end if;

  if v_super and public.super_commits_left() < 1 then raise exception 'no super commits left today'; end if;

  insert into public.swipes(swiper_id, target_id, target_type, project_id, role, direction, is_super)
    values (v_uid, p_target_id, p_target_type, p_project_id, p_role, v_dir, v_super)
  on conflict (swiper_id, target_id, project_id)
    do update set direction = excluded.direction, role = excluded.role, is_super = excluded.is_super, created_at = now();

  if v_dir = 'left' then return jsonb_build_object('matched', false); end if;

  if p_target_type = 'project' then
    -- Applicant liked a project. Match if the owner liked this applicant for this project.
    select * into v_rev from public.swipes
      where swiper_id = v_owner and target_id = v_uid and target_type = 'person'
        and project_id = p_project_id and direction = 'right'
      order by created_at desc limit 1;
    v_match_project := p_project_id; v_match_user := v_uid;
    v_role := coalesce(p_role, v_rev.role);
  else
    -- Owner liked a person. Match if that person liked this project (normal), or liked the caller
    -- from their own hack shell (hack mode, person to person).
    -- A hack match only counts swipes made from hack shells on both sides, so a Normal-mode like
    -- never turns into a Hack match.
    select s.* into v_rev from public.swipes s
      where s.swiper_id = p_target_id and s.direction = 'right' and (
        (s.target_type = 'project' and s.target_id = p_project_id)
        or (s.target_type = 'person' and s.target_id = v_uid
            and exists (select 1 from public.projects mine where mine.id = p_project_id and mine.type = 'hackathon')
            and exists (select 1 from public.projects theirs where theirs.id = s.project_id and theirs.type = 'hackathon')))
      order by s.created_at desc limit 1;
    v_match_project := p_project_id; v_match_user := p_target_id;
    v_role := coalesce(v_rev.role, p_role);
  end if;

  if v_rev.id is null then return jsonb_build_object('matched', false); end if;

  if v_role is null then
    select coalesce(primary_role, 'Backend') into v_role from public.profiles where id = v_match_user;
  end if;

  insert into public.matches(project_id, user_id, role)
    values (v_match_project, v_match_user, v_role)
  on conflict on constraint matches_unique do nothing
  returning id into v_match_id;
  if v_match_id is null then
    select id into v_match_id from public.matches
      where project_id = v_match_project and user_id = v_match_user and role = v_role;
  end if;
  return jsonb_build_object('matched', true, 'matchId', v_match_id);
end $$;

-- Undo the caller's latest swipe, only if no match has formed from it.
create or replace function public.undo_last_swipe() returns void
language plpgsql security definer set search_path = '' as $$
declare s public.swipes;
begin
  select * into s from public.swipes where swiper_id = auth.uid() order by created_at desc limit 1;
  if s.id is null then return; end if;
  if exists (select 1 from public.matches m where m.project_id = s.project_id and m.created_at >= s.created_at
             and (m.user_id = auth.uid() or m.user_id = s.target_id)) then
    raise exception 'already matched, cannot undo';
  end if;
  delete from public.swipes where id = s.id;
end $$;

-- ---------- committing ----------

-- Sets the caller's commit flag. When both sides committed, adds the member, with a row lock on the
-- role so two people cannot take the last slot (F4). Hack teams cap at 4 members.
create or replace function public.commit_to_project(p_match_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); m public.matches; p public.projects; r public.project_roles; v_count int;
begin
  if v_uid is null then raise exception 'not signed in'; end if;
  select * into m from public.matches where id = p_match_id for update;
  if m.id is null then raise exception 'match not found'; end if;
  select * into p from public.projects where id = m.project_id;

  if v_uid = p.owner_id then
    update public.matches set owner_committed = true where id = m.id;
  elsif v_uid = m.user_id then
    update public.matches set user_committed = true where id = m.id;
  else
    raise exception 'not part of this match';
  end if;
  select * into m from public.matches where id = p_match_id;

  if m.owner_committed and m.user_committed
     and not exists (select 1 from public.team_members where project_id = m.project_id and user_id = m.user_id) then
    insert into public.team_members(project_id, user_id, role, ownership)
      select p.id, p.owner_id, coalesce(pr.primary_role, 'Backend'), 'owner' from public.profiles pr where pr.id = p.owner_id
    on conflict do nothing;

    if p.type = 'hackathon' then
      select count(*) into v_count from public.team_members where project_id = p.id and status = 'active';
      if v_count >= 4 then raise exception 'team is full (max 4)'; end if;
      update public.project_roles set slots_open = slots_open - 1
        where id = (select id from public.project_roles where project_id = p.id and role = m.role and slots_open > 0
                    limit 1 for update);
    else
      select * into r from public.project_roles where project_id = p.id and role = m.role
        order by slots_open desc limit 1 for update;
      if r.id is null or r.slots_open <= 0 then raise exception 'no open slot for this role'; end if;
      update public.project_roles set slots_open = slots_open - 1 where id = r.id;
    end if;

    insert into public.team_members(project_id, user_id, role, ownership)
      values (p.id, m.user_id, m.role, 'collaborator');
  end if;

  return jsonb_build_object('both', m.owner_committed and m.user_committed, 'isTeam', p.type = 'hackathon');
end $$;

-- ---------- reliability (server only) ----------

-- +5 completed, -15 ghosted, -3 graceful exit. Clamped to 0..100. Not callable by clients.
create or replace function public.adjust_reliability(p_user uuid, p_event text) returns int
language plpgsql security definer set search_path = '' as $$
declare v_delta int; v_new int;
begin
  v_delta := case p_event when 'completed' then 5 when 'ghosted' then -15 when 'graceful_exit' then -3
             else null end;
  if v_delta is null then raise exception 'unknown event'; end if;
  update public.profiles set reliability_score = least(100, greatest(0, coalesce(reliability_score, 70) + v_delta))
    where id = p_user returning reliability_score into v_new;
  return v_new;
end $$;

-- ---------- who wants you (F5) ----------

-- Right swipes on the caller or the caller's projects that the caller has not answered.
-- Returns role, level and super flag only. Never a name, id or photo.
create or replace function public.get_interested() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'swipeRef', s.id, 'role', coalesce(s.role, pr.primary_role, 'Backend'),
      'level', coalesce(pr.level, 'intermediate'), 'isSuper', s.is_super)
    order by s.is_super desc, s.created_at desc), '[]'::jsonb)
  from public.swipes s
  join public.profiles pr on pr.id = s.swiper_id
  where auth.uid() is not null and s.direction = 'right' and s.swiper_id <> auth.uid()
    and (
      (s.target_type = 'person' and s.target_id = auth.uid())
      or (s.target_type = 'project' and s.target_id in (select id from public.projects where owner_id = auth.uid()))
    )
    and not exists (select 1 from public.swipes back where back.swiper_id = auth.uid() and back.target_id = s.swiper_id);
$$;

-- ---------- the deck (F6) ----------

-- Returns Card[] in the exact shape of lib/types.ts. Ranking:
-- 0.5 * skillGapFit + 0.3 * reliability/100 + 0.2 * availabilityOverlap, super cards first.
-- Women mode only for women_only viewers, and only women_only content. Normal never shows women_only content.
create or replace function public.get_deck(p_mode text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid(); v public.profiles; v_women boolean; v_my_project uuid; v_hack uuid;
  v_my_open text[]; v_cards jsonb;
begin
  if v_uid is null then raise exception 'not signed in'; end if;
  if p_mode not in ('normal','women','hack') then raise exception 'bad mode'; end if;
  select * into v from public.profiles where id = v_uid;
  if v.id is null then raise exception 'create a profile first'; end if;
  v_women := p_mode = 'women';
  if v_women and not coalesce(v.women_only, false) then return '[]'::jsonb; end if;

  if p_mode = 'hack' then
    v_hack := public.ensure_hack_team(null);
    select coalesce(array_agg(role), '{}') into v_my_open from public.project_roles where project_id = v_hack and slots_open > 0;
    select coalesce(jsonb_agg(c.card order by c.is_super desc, c.score desc, c.username), '[]'::jsonb) into v_cards from (
      select pr.username,
        exists (select 1 from public.swipes s where s.swiper_id = pr.id and s.target_id = v_uid and s.is_super) as is_super,
        (0.5 * (case when pr.primary_role = any(v_my_open) then 1 when cardinality(v_my_open) = 0 then 0.5 else 0 end)
         + 0.3 * coalesce(pr.reliability_score, 70) / 100.0
         + 0.2 * (case when pr.hours_per_week is null or v.hours_per_week is null then 0.5
                  else greatest(0, 1 - abs(pr.hours_per_week - v.hours_per_week) / 40.0) end)) as score,
        jsonb_build_object(
          'kind', 'person', 'id', pr.id, 'username', coalesce(pr.username, pr.name), 'avatarUrl', pr.avatar_url,
          'role', coalesce(pr.primary_role, 'Backend'), 'level', coalesce(pr.level, 'intermediate'),
          'occupation', coalesce(pr.occupation, 'student'), 'skills', to_jsonb(public.skill_names(pr.skills)),
          'prompts', coalesce(pr.prompts, '[]'::jsonb), 'reliability', coalesce(pr.reliability_score, 70),
          'reason', case when pr.primary_role = any(v_my_open) then 'Your team needs ' || pr.primary_role
                         else 'Strong reliability' end,
          'isSuper', exists (select 1 from public.swipes s where s.swiper_id = pr.id and s.target_id = v_uid and s.is_super),
          'rolesNeeded', coalesce(public.project_role_counts(ht.id), '[]'::jsonb),
          'forProjectId', v_hack, 'boxPublicKey', pr.box_public_key) as card
      from public.profiles pr
      join public.projects ht on ht.owner_id = pr.id and ht.type = 'hackathon' and ht.hidden is true
      where pr.id <> v_uid
        and (not coalesce(pr.women_only, false) or coalesce(v.women_only, false)) -- F6: women profiles stay hidden
        and not exists (select 1 from public.swipes s where s.swiper_id = v_uid and s.target_id = pr.id and s.project_id = v_hack)
        and not exists (select 1 from public.team_members tm where tm.project_id = v_hack and tm.user_id = pr.id)
      limit 50) c;
    return v_cards;
  end if;

  -- Normal and Women: projects to join, plus people for the viewer's own newest visible project.
  select id into v_my_project from public.projects
    where owner_id = v_uid and hidden is not true and coalesce(type, 'original') <> 'hackathon'
    order by created_at desc limit 1;
  select coalesce(array_agg(role), '{}') into v_my_open from public.project_roles
    where project_id = v_my_project and slots_open > 0;

  with proj as (
    select p.*, o.username as owner_username, o.name as owner_name, o.reliability_score as owner_rel,
      o.box_public_key as owner_key, o.hours_per_week as owner_hours,
      exists (select 1 from public.swipes s where s.swiper_id = p.owner_id and s.target_id = v_uid and s.is_super) as is_super,
      exists (select 1 from public.project_roles r where r.project_id = p.id and r.role = v.primary_role and r.slots_open > 0) as fits
    from public.projects p join public.profiles o on o.id = p.owner_id
    where p.owner_id <> v_uid and p.hidden is not true and coalesce(p.type, 'original') <> 'hackathon'
      and coalesce(p.women_only, false) = v_women
      and not exists (select 1 from public.swipes s where s.swiper_id = v_uid and s.target_id = p.id)
  ), ppl as (
    select pr.*,
      exists (select 1 from public.swipes s where s.swiper_id = pr.id and s.target_id = v_my_project and s.is_super) as is_super
    from public.profiles pr
    where v_my_project is not null and pr.id <> v_uid
      and coalesce(pr.women_only, false) = v_women
      and not exists (select 1 from public.swipes s where s.swiper_id = v_uid and s.target_id = pr.id and s.project_id = v_my_project)
      and not exists (select 1 from public.team_members tm where tm.project_id = v_my_project and tm.user_id = pr.id)
  ), cards as (
    select proj.is_super, proj.created_at,
      0.5 * (case when proj.fits then 1 else 0 end) + 0.3 * coalesce(proj.owner_rel, 70) / 100.0
        + 0.2 * (case when proj.hours_per_week is null or v.hours_per_week is null then 0.5
                 else greatest(0, 1 - abs(proj.hours_per_week - v.hours_per_week) / 40.0) end) as score,
      jsonb_build_object(
        'kind', 'project', 'id', proj.id, 'title', proj.title, 'teaser', proj.short_pitch,
        'visibility', coalesce(proj.visibility, 'private'),
        'fullIdea', case when proj.visibility = 'public' then proj.idea_public end,
        'theme', coalesce(proj.theme, proj.field, 'General'), 'timeframe', coalesce(proj.timeframe, 'weekend'),
        'githubUrl', proj.github_url, 'roles', public.project_role_counts(proj.id),
        'ownerUsername', coalesce(proj.owner_username, proj.owner_name), 'ownerReliability', coalesce(proj.owner_rel, 70),
        'ownerBoxPublicKey', proj.owner_key,
        'reason', case when proj.fits then 'Needs a ' || v.primary_role || ', you are one' else 'Matches your hours' end,
        'commitHash', public.project_commit_hash(proj.id), 'isSuper', proj.is_super) as card
    from proj
    union all
    select ppl.is_super, ppl.created_at,
      0.5 * (case when ppl.primary_role = any(v_my_open) then 1 else 0 end) + 0.3 * coalesce(ppl.reliability_score, 70) / 100.0
        + 0.2 * (case when ppl.hours_per_week is null or v.hours_per_week is null then 0.5
                 else greatest(0, 1 - abs(ppl.hours_per_week - v.hours_per_week) / 40.0) end),
      jsonb_build_object(
        'kind', 'person', 'id', ppl.id, 'username', coalesce(ppl.username, ppl.name), 'avatarUrl', ppl.avatar_url,
        'role', coalesce(ppl.primary_role, 'Backend'), 'level', coalesce(ppl.level, 'intermediate'),
        'occupation', coalesce(ppl.occupation, 'student'), 'skills', to_jsonb(public.skill_names(ppl.skills)),
        'prompts', coalesce(ppl.prompts, '[]'::jsonb), 'reliability', coalesce(ppl.reliability_score, 70),
        'reason', case when ppl.primary_role = any(v_my_open) then 'Fills your ' || ppl.primary_role || ' gap'
                       else 'Strong reliability' end,
        'isSuper', ppl.is_super, 'forProjectId', v_my_project, 'boxPublicKey', ppl.box_public_key)
    from ppl
  )
  select coalesce(jsonb_agg(card order by is_super desc, score desc, created_at), '[]'::jsonb) into v_cards
  from (select * from cards order by is_super desc, score desc, created_at limit 50) c;
  return v_cards;
end $$;

-- ---------- grants ----------

revoke all on function
  public.skill_names(jsonb), public.project_commit_hash(uuid), public.project_role_counts(uuid),
  public.ensure_hack_team(jsonb), public.super_commits_left(), public.record_swipe(uuid, text, uuid, text, text),
  public.undo_last_swipe(), public.commit_to_project(uuid), public.adjust_reliability(uuid, text),
  public.get_interested(), public.get_deck(text)
from public, anon;

grant execute on function
  public.skill_names(jsonb), public.project_commit_hash(uuid), public.project_role_counts(uuid),
  public.ensure_hack_team(jsonb), public.super_commits_left(), public.record_swipe(uuid, text, uuid, text, text),
  public.undo_last_swipe(), public.commit_to_project(uuid), public.get_interested(), public.get_deck(text)
to authenticated;

revoke all on function public.adjust_reliability(uuid, text) from authenticated;
grant execute on function public.adjust_reliability(uuid, text) to service_role;

commit;
