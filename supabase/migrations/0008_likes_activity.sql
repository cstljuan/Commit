-- 0008_likes_activity.sql (shahd-agent). Like back on Who wants you, and a reliability event log.
begin;

-- ---------- reliability events (Score screen) ----------

create table public.reliability_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  label text not null,
  delta int not null,
  created_at timestamptz not null default now()
);
alter table public.reliability_events enable row level security;
revoke all on public.reliability_events from anon, authenticated;
grant select on public.reliability_events to authenticated;
create policy "reliability events own" on public.reliability_events for select to authenticated
  using ((select auth.uid()) = user_id);

-- Same rules as 0006 (+5 completed, -15 ghosted, -3 graceful exit), now also logged. Server only.
create or replace function public.adjust_reliability(p_user uuid, p_event text) returns int
language plpgsql security definer set search_path = '' as $$
declare v_delta int; v_label text; v_new int;
begin
  select d, l into v_delta, v_label from (values
    ('completed', 5, 'Finished a project'),
    ('ghosted', -15, 'Disappeared from a team'),
    ('graceful_exit', -3, 'Left a team with notice')) as t(e, d, l) where e = p_event;
  if v_delta is null then raise exception 'unknown event'; end if;
  update public.profiles set reliability_score = least(100, greatest(0, coalesce(reliability_score, 70) + v_delta))
    where id = p_user returning reliability_score into v_new;
  insert into public.reliability_events(user_id, label, delta) values (p_user, v_label, v_delta);
  return v_new;
end $$;
revoke all on function public.adjust_reliability(uuid, text) from public, anon, authenticated;
grant execute on function public.adjust_reliability(uuid, text) to service_role;

-- ---------- Who wants you: respond to a blurred card (F5) ----------

-- A card is answered once the caller swiped back on that person or on the project they liked from.
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
    and not exists (select 1 from public.swipes back where back.swiper_id = auth.uid()
                    and (back.target_id = s.swiper_id or back.target_id = s.project_id));
$$;

-- Like (or pass on) a blurred card without ever seeing who it is first.
-- Like: records the swipe back and creates the match. Identity is only readable after this, through matches.
-- Returns { matched, matchId }.
create or replace function public.respond_interested(p_swipe_ref uuid, p_like boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); s public.swipes; v_dir text := case when p_like then 'right' else 'left' end;
  v_project uuid; v_user uuid; v_role text; v_match uuid;
begin
  if v_uid is null then raise exception 'not signed in'; end if;
  select * into s from public.swipes where id = p_swipe_ref and direction = 'right';
  if s.id is null then raise exception 'card not found'; end if;

  if s.target_type = 'person' and s.target_id = v_uid then
    -- They liked me for their project: I swipe back on that project.
    insert into public.swipes(swiper_id, target_id, target_type, project_id, role, direction)
      values (v_uid, s.project_id, 'project', s.project_id, s.role, v_dir)
    on conflict (swiper_id, target_id, project_id) do update set direction = excluded.direction, created_at = now();
    v_project := s.project_id; v_user := v_uid;
  elsif s.target_type = 'project' and exists (select 1 from public.projects where id = s.target_id and owner_id = v_uid) then
    -- They liked my project: I swipe back on them for it.
    insert into public.swipes(swiper_id, target_id, target_type, project_id, role, direction)
      values (v_uid, s.swiper_id, 'person', s.target_id, s.role, v_dir)
    on conflict (swiper_id, target_id, project_id) do update set direction = excluded.direction, created_at = now();
    v_project := s.target_id; v_user := s.swiper_id;
  else
    raise exception 'not your card';
  end if;

  if not p_like then return jsonb_build_object('matched', false); end if;

  select coalesce(s.role, primary_role, 'Backend') into v_role from public.profiles where id = v_user;
  insert into public.matches(project_id, user_id, role) values (v_project, v_user, v_role)
  on conflict on constraint matches_unique do nothing returning id into v_match;
  if v_match is null then
    select id into v_match from public.matches where project_id = v_project and user_id = v_user and role = v_role;
  end if;
  return jsonb_build_object('matched', true, 'matchId', v_match);
end $$;

revoke all on function public.get_interested(), public.respond_interested(uuid, boolean) from public, anon;
grant execute on function public.get_interested(), public.respond_interested(uuid, boolean) to authenticated;

commit;
