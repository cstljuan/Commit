-- 0012_women_only_guard.sql (shahd-agent). Keeps the 0009 security property (users cannot give
-- themselves Women mode) without breaking app builds that still send women_only in saveProfile.
-- Clients may send the column again, but a trigger ignores it: new rows get false, updates keep the
-- old value. Only the service role (seed, admin) can set it.
begin;

create or replace function public.guard_women_only() returns trigger
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
revoke all on function public.guard_women_only() from public, anon, authenticated;

drop trigger if exists profiles_guard_women_only on public.profiles;
create trigger profiles_guard_women_only before insert or update on public.profiles
for each row execute function public.guard_women_only();

grant insert (women_only), update (women_only) on public.profiles to authenticated;

commit;
