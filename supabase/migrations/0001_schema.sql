-- 0001_schema.sql (shahd-agent). Handoff section 7.1, plus fix F2.
create extension if not exists vector;

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null,
  avatar_url text,
  bio text,
  skills jsonb default '[]',          -- [{ "skill": "Backend", "level": "intermediate" }]
  hours_per_week int,
  timezone text,
  links jsonb default '{}',
  reliability_score int default 70,
  women_only boolean default false,
  box_public_key text,                -- nacl.box public key, base64
  sign_public_key text,               -- nacl.sign public key, base64
  created_at timestamptz default now()
);

create table projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references profiles(id) on delete cascade,
  title text not null,
  short_pitch text not null,          -- public
  type text check (type in ('original','practice','hackathon')),
  field text,
  hours_per_week int,
  women_only boolean default false,
  idea_cipher text,                   -- secretbox ciphertext, base64
  idea_nonce text,
  created_at timestamptz default now()
);

create table project_roles (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  role text not null,
  level text,
  slots_open int default 1
);

create table swipes (
  id uuid primary key default gen_random_uuid(),
  swiper_id uuid references profiles(id) on delete cascade,
  target_id uuid not null,
  target_type text check (target_type in ('person','project')),
  project_id uuid references projects(id) on delete cascade,
  role text,
  direction text check (direction in ('left','right')),
  created_at timestamptz default now(),
  unique (swiper_id, target_id, project_id)
);

create table matches (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  role text,
  owner_committed boolean default false,
  user_committed boolean default false,
  created_at timestamptz default now()
);

create table team_members (
  project_id uuid references projects(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  role text,
  ownership text check (ownership in ('owner','co-owner','collaborator')),
  status text default 'active',
  joined_at timestamptz default now(),
  primary key (project_id, user_id)
);

create table team_keys (
  project_id uuid references projects(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  encrypted_team_key text,
  nonce text,
  sender_public_key text,
  primary key (project_id, user_id)
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  sender_id uuid references profiles(id),
  ciphertext text not null,
  nonce text not null,
  created_at timestamptz default now()
);

-- Copy detection: embeddings are never readable by clients
create table idea_embeddings (
  project_id uuid primary key references projects(id) on delete cascade,
  embedding vector(384)               -- 1536 if we fall back to OpenAI (F19, test 4)
);

create table copy_alerts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references profiles(id) on delete cascade,
  original_project_id uuid references projects(id) on delete cascade,
  similarity float,
  created_at timestamptz default now()
);

create table post_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  max_similarity float,
  created_at timestamptz default now()
);

-- Proof screens read these, updated live via Realtime
create table eval_results (
  id uuid primary key default gen_random_uuid(),
  threshold float, precision float, recall float, chosen boolean default false,
  created_at timestamptz default now()
);
create table redteam_runs (
  id uuid primary key default gen_random_uuid(),
  kind text check (kind in ('oracle','rls')),
  version text check (version in ('v1','v2')),
  attempts int, revealed int, denied int,
  details jsonb,
  created_at timestamptz default now()
);

create or replace function match_projects(query_embedding vector(384), match_threshold float, match_count int)
returns table (project_id uuid, owner_id uuid, similarity float)
language sql stable as $$
  select e.project_id, p.owner_id, 1 - (e.embedding <=> query_embedding) as similarity
  from idea_embeddings e join projects p on p.id = e.project_id
  where 1 - (e.embedding <=> query_embedding) > match_threshold
  order by e.embedding <=> query_embedding
  limit match_count;
$$;

-- F2: functions are executable by public by default. Only the service role (Edge Functions) may call this.
revoke execute on function match_projects(vector, float, int) from public, anon, authenticated;
grant execute on function match_projects(vector, float, int) to service_role;
