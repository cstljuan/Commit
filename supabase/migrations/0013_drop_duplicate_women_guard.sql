-- 0013_drop_duplicate_women_guard.sql (shahd-agent). 0009 (updated) and 0012 both added a trigger that
-- pins profiles.women_only for clients. Keep 0009's profiles_lock_women_only, drop the 0012 duplicate.
begin;
drop trigger if exists profiles_guard_women_only on public.profiles;
drop function if exists public.guard_women_only();
commit;
