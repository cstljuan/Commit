-- 0015_occupation_both.sql (juan-claude). People who study and work can say so.
-- The app sends 'both'; until this runs it falls back to 'student' instead of failing the save.
begin;

alter table public.profiles drop constraint if exists profiles_occupation_check;
alter table public.profiles
  add constraint profiles_occupation_check check (occupation in ('student', 'working', 'both'));

commit;
