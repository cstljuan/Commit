begin;
create table public.vault_log (
  seq bigserial primary key,
  project_id uuid not null references public.projects(id) on delete restrict, -- F3: preserve the global chain
  author_id uuid not null references public.profiles(id) on delete restrict,
  idea_hash text not null check (idea_hash ~ '^[0-9a-f]{64}$'),
  ts timestamptz not null,
  author_sig text not null,
  prev_hash text not null check (prev_hash ~ '^[0-9a-f]{64}$'),
  entry_hash text not null check (entry_hash ~ '^[0-9a-f]{64}$')
);
alter table public.vault_log enable row level security;
create policy "vault read" on public.vault_log for select to authenticated using (true);
create table public.vault_checkpoints (
  id bigserial primary key,
  last_seq bigint not null,
  last_entry_hash text not null check (last_entry_hash ~ '^[0-9a-f]{64}$'),
  server_sig text not null,
  created_at timestamptz not null default now()
);
alter table public.vault_checkpoints enable row level security;
create policy "checkpoints read" on public.vault_checkpoints for select to authenticated using (true);
revoke all on public.vault_log, public.vault_checkpoints from anon, authenticated;
grant select on public.vault_log, public.vault_checkpoints to authenticated;
grant all on public.vault_log, public.vault_checkpoints to service_role;
grant usage, select on sequence public.vault_log_seq_seq, public.vault_checkpoints_id_seq to service_role;
create index vault_checkpoints_seq on public.vault_checkpoints(last_seq desc);

create or replace function public.append_vault_entry(p_project uuid, p_idea_hash text, p_ts timestamptz, p_sig text)
returns public.vault_log language plpgsql security definer set search_path = '' as $$
declare v_prev text; v_row public.vault_log; v_content text;
begin
  if auth.uid() is null or not public.is_project_owner(p_project) then raise exception 'not owner'; end if;
  if p_idea_hash is null or p_idea_hash !~ '^[0-9a-f]{64}$' or p_ts is null or not isfinite(p_ts)
     or p_sig is null or p_sig !~ '^[A-Za-z0-9+/]{86}==$' then raise exception 'invalid vault content'; end if;
  if not exists (select 1 from public.profiles where id = auth.uid() and sign_public_key is not null) then
    raise exception 'register signing keys first';
  end if;
  perform pg_advisory_xact_lock(42);
  -- Lock the project against concurrent deletion for the duration of the append.
  perform 1 from public.projects where id = p_project and owner_id = auth.uid() for key share;
  select entry_hash into v_prev from public.vault_log order by seq desc limit 1;
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

-- Verification needs only the signing keys of public vault authors, even when Women profiles are hidden.
create or replace function public.vault_signing_keys() returns table(author_id uuid, sign_public_key text)
language sql security definer stable set search_path = '' as $$
  select p.id, p.sign_public_key from public.profiles p
  where auth.uid() is not null and exists(select 1 from public.vault_log v where v.author_id = p.id);
$$;
revoke all on function public.vault_signing_keys() from public, anon;
grant execute on function public.vault_signing_keys() to authenticated;
commit;
