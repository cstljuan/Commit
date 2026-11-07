-- 0014_reliability_applied_delta.sql (juan-claude, Round 2 R4).
-- The score is clamped to 0..100, but the event log stored the full rule delta. A user at 98 who
-- finished a project got +5 in the log and +2 on the score, so the Score screen invented a
-- "Seeded demo history" line to explain the gap. Log what was actually applied instead, and skip
-- the row when nothing changed. Same rules, same grants, still server only.
begin;

create or replace function public.adjust_reliability(p_user uuid, p_event text) returns int
language plpgsql security definer set search_path = '' as $$
declare v_delta int; v_label text; v_old int; v_new int;
begin
  select d, l into v_delta, v_label from (values
    ('completed', 5, 'Finished a project'),
    ('ghosted', -15, 'Disappeared from a team'),
    ('graceful_exit', -3, 'Left a team with notice')) as t(e, d, l) where e = p_event;
  if v_delta is null then raise exception 'unknown event'; end if;
  select coalesce(reliability_score, 70) into v_old from public.profiles where id = p_user for update;
  if v_old is null then raise exception 'unknown user'; end if;
  v_new := least(100, greatest(0, v_old + v_delta));
  update public.profiles set reliability_score = v_new where id = p_user;
  if v_new <> v_old then
    insert into public.reliability_events(user_id, label, delta) values (p_user, v_label, v_new - v_old);
  end if;
  return v_new;
end $$;
revoke all on function public.adjust_reliability(uuid, text) from public, anon, authenticated;
grant execute on function public.adjust_reliability(uuid, text) to service_role;

commit;
