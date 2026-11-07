-- 0011_reliability.sql (shahd-agent, W4). Real reliability events from the app.
-- complete_project: the owner marks a project finished, every active member (owner included) gets +5.
-- leave_team: a member leaves with notice, gets -3, and their slot opens again.
-- Both call adjust_reliability (0008), which stays service-role only for direct calls.
-- No time-based recovery: finishing more projects is the only way to earn points back.
begin;

alter table public.projects add column if not exists completed_at timestamptz;

-- Owners can write their own projects row (0002), so stop clients from setting or clearing
-- completed_at directly. Clearing it would let an owner complete the same project again.
-- Only the definer functions below (running as the table owner) may change it.
create or replace function public.guard_project_completed_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.completed_at := null;
    elsif new.completed_at is distinct from old.completed_at then
      raise exception 'completed_at is set by complete_project only';
    end if;
  end if;
  return new;
end $$;
revoke all on function public.guard_project_completed_at() from public, anon, authenticated;

drop trigger if exists projects_guard_completed_at on public.projects;
create trigger projects_guard_completed_at before insert or update on public.projects
for each row execute function public.guard_project_completed_at();

-- Owner only, once per project. Needs at least one active member besides the owner, so a solo
-- project cannot be "finished" for free points. Returns { completed: true, members: n }.
create or replace function public.complete_project(p_project uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); p public.projects; v_member uuid; v_n int := 0;
begin
  if v_uid is null then raise exception 'not signed in'; end if;
  if not public.is_project_owner(p_project) then raise exception 'only the project owner can mark it complete'; end if;
  select * into p from public.projects where id = p_project for update;
  if p.id is null then raise exception 'project not found'; end if;
  if p.completed_at is not null then raise exception 'project already completed'; end if;
  if not exists (select 1 from public.team_members tm
                 where tm.project_id = p.id and tm.status = 'active' and tm.user_id <> p.owner_id) then
    raise exception 'a project needs at least one active teammate to be completed';
  end if;

  update public.projects set completed_at = now() where id = p.id;

  for v_member in
    select tm.user_id from public.team_members tm where tm.project_id = p.id and tm.status = 'active'
    union
    select p.owner_id
  loop
    perform public.adjust_reliability(v_member, 'completed');
    v_n := v_n + 1;
  end loop;

  return jsonb_build_object('completed', true, 'members', v_n);
end $$;

-- Active non-owner member only, and only while the project is not completed.
-- Marks them 'left' (is_team_member then drops their chat access), -3, and re-opens their role slot.
create or replace function public.leave_team(p_project uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); p public.projects; tm public.team_members; v_role_id uuid;
begin
  if v_uid is null then raise exception 'not signed in'; end if;
  select * into p from public.projects where id = p_project for update;
  if p.id is null then raise exception 'project not found'; end if;
  if p.owner_id = v_uid then raise exception 'the owner cannot leave their own project'; end if;
  select * into tm from public.team_members t where t.project_id = p.id and t.user_id = v_uid for update;
  if tm.user_id is null or tm.status <> 'active' then raise exception 'not an active member of this team'; end if;
  if tm.ownership = 'owner' then raise exception 'the owner cannot leave their own project'; end if;
  if p.completed_at is not null then raise exception 'project already completed'; end if;

  update public.team_members set status = 'left' where project_id = p.id and user_id = v_uid;

  select id into v_role_id from public.project_roles
    where project_id = p.id and role = tm.role order by slots_open desc limit 1 for update;
  if v_role_id is not null then
    update public.project_roles set slots_open = coalesce(slots_open, 0) + 1 where id = v_role_id;
  elsif tm.role is not null then
    insert into public.project_roles(project_id, role, slots_open) values (p.id, tm.role, 1);
  end if;

  perform public.adjust_reliability(v_uid, 'graceful_exit');
  return jsonb_build_object('left', true);
end $$;

revoke all on function public.complete_project(uuid), public.leave_team(uuid) from public, anon;
grant execute on function public.complete_project(uuid), public.leave_team(uuid) to authenticated;

-- Unchanged: direct calls stay server only.
revoke all on function public.adjust_reliability(uuid, text) from public, anon, authenticated;
grant execute on function public.adjust_reliability(uuid, text) to service_role;

commit;
