-- 0004_modes_and_fun.sql (shahd-agent). 03-CONTRACTS.md, section 2. Additive only.
-- juan-codex follows with 0005_rls_additions.sql (RLS on match_messages, column grants per F1).

alter table profiles
  add column username text unique,
  add column primary_role text,
  add column level text check (level in ('beginner','intermediate','advanced')),
  add column occupation text check (occupation in ('student','working')),
  add column prompts jsonb default '[]';   -- [{ "q": "Worst commit message", "a": "fix fix fix" }]

alter table projects
  add column visibility text check (visibility in ('private','public')) default 'private',
  add column theme text,
  add column github_url text,
  add column timeframe text,               -- 'weekend', '1 month', 'semester', 'ongoing'
  add column idea_public text,             -- full text, only when visibility = 'public'
  add column hidden boolean default false; -- attack scripts set this so junk never reaches decks

alter table swipes add column is_super boolean default false;
alter table matches add constraint matches_unique unique (project_id, user_id, role);

create table match_messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references matches(id) on delete cascade,
  sender_id uuid references profiles(id),
  body text not null,
  created_at timestamptz default now()
);

-- F7: live screens need these tables in the Realtime publication.
alter publication supabase_realtime add table
  matches, match_messages, messages, copy_alerts, redteam_runs, eval_results;
