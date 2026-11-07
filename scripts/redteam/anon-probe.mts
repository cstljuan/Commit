// Red-team probe: what can someone holding only the public anon key do, with no session?
// Run: npx tsx scripts/redteam/anon-probe.mts
// Reads the project URL and anon key from .env and never prints them.
// PASS means access was correctly denied (error) or came back empty. Writes are probes that must fail.
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const env: Record<string, string> = {};
for (const line of readFileSync(new URL('../../.env', import.meta.url), 'utf8').split('\n')) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
  if (m) env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
}
const URL_ = env.EXPO_PUBLIC_SUPABASE_URL;
const ANON = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!URL_ || !ANON) throw new Error('Missing project config in .env');

const scrub = (s: unknown): string =>
  String(s ?? '').split(URL_).join('<project>').split(ANON).join('<anon>').replace(/\s+/g, ' ').slice(0, 70);

const sb = createClient(URL_, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
const NIL = '00000000-0000-0000-0000-000000000000';
const HEX = '0'.repeat(64);

type Row = { area: string; probe: string; result: 'PASS' | 'FAIL' | 'CRITICAL'; detail: string };
const rows: Row[] = [];
const add = (area: string, probe: string, ok: boolean, detail: string, critical = false) =>
  rows.push({ area, probe, result: ok ? 'PASS' : critical ? 'CRITICAL' : 'FAIL', detail: scrub(detail) });

type PgErr = { code?: string; message?: string } | null;
const errText = (e: PgErr) => (e ? `${e.code ?? ''} ${e.message ?? ''}`.trim() : '');

// 1. Selects on every table in supabase/migrations
const tables = [
  'profiles', 'projects', 'project_roles', 'swipes', 'matches', 'team_members', 'team_keys', 'messages',
  'idea_embeddings', 'copy_alerts', 'post_attempts', 'eval_results', 'redteam_runs', 'match_messages',
  'vault_log', 'vault_checkpoints', 'reliability_events',
];
for (const t of tables) {
  const { data, error } = await sb.from(t).select('*').limit(1);
  const n = Array.isArray(data) ? data.length : 0;
  add('select', t, !!error || n === 0, error ? errText(error) : `${n} row(s)`);
}

// Sensitive columns, asked for by name
const cols: [string, string][] = [
  ['projects', 'id,idea_cipher,idea_nonce,idea_public'],
  ['profiles', 'id,box_public_key,sign_public_key,reliability_score'],
  ['match_messages', 'id,body'],
  ['vault_log', 'seq,author_id,idea_hash,author_sig'],
  ['copy_alerts', 'id,copier_id'],
];
for (const [t, c] of cols) {
  const { data, error } = await sb.from(t).select(c).limit(1);
  const n = Array.isArray(data) ? data.length : 0;
  add('column', `${t}(${c.split(',').slice(1).join(',')})`, !!error || n === 0, error ? errText(error) : `${n} row(s)`);
}

// 2. Every RPC defined in the migrations, no session. Nil ids so nothing real could be touched.
const zeros = `[${new Array(384).fill(0).join(',')}]`;
const rpcs: [string, Record<string, unknown>][] = [
  ['match_projects', { query_embedding: zeros, match_threshold: 0, match_count: 1 }],
  ['is_team_member', { p: NIL }],
  ['is_project_owner', { p: NIL }],
  ['is_women_member', {}],
  ['append_vault_entry', { p_project: NIL, p_idea_hash: HEX, p_ts: new Date().toISOString(), p_sig: 'redteam-probe' }],
  ['vault_signing_keys', {}],
  ['skill_names', { p: [] }],
  ['project_commit_hash', { p: NIL }],
  ['project_role_counts', { p: NIL }],
  ['ensure_hack_team', { p_roles: null }],
  ['super_commits_left', {}],
  ['record_swipe', { p_target_id: NIL, p_target_type: 'project', p_project_id: NIL, p_role: 'redteam-probe', p_direction: 'left' }],
  ['undo_last_swipe', {}],
  ['commit_to_project', { p_match_id: NIL }],
  ['adjust_reliability', { p_user: NIL, p_event: 'completed' }],
  ['get_interested', {}],
  ['respond_interested', { p_swipe_ref: NIL, p_like: false }],
  ['get_deck', { p_mode: 'normal' }],
  ['preserve_profile_keys', {}],
];
for (const [fn, args] of rpcs) {
  const { data, error } = await sb.rpc(fn, args);
  const empty = data === null || (Array.isArray(data) && data.length === 0);
  add('rpc', fn, !!error || empty, error ? errText(error) : `returned ${JSON.stringify(data)}`);
}

// 3. Insert probes. Must fail. Our own ids, so a success can be reported exactly and never retried.
const inserts: [string, Record<string, unknown>, string][] = [
  ['match_messages', { id: randomUUID(), match_id: NIL, sender_id: NIL, body: 'redteam-probe' }, 'id'],
  ['swipes', { id: randomUUID(), swiper_id: NIL, target_id: NIL, target_type: 'project', direction: 'left', role: 'redteam-probe' }, 'id'],
  ['projects', { id: randomUUID(), title: 'redteam-probe', short_pitch: 'redteam-probe', hidden: true }, 'id'],
  ['vault_log', { project_id: NIL, author_id: NIL, idea_hash: HEX, ts: new Date().toISOString(), author_sig: 'redteam-probe', prev_hash: HEX, entry_hash: HEX }, 'seq'],
  ['reliability_events', { id: randomUUID(), user_id: NIL, label: 'redteam-probe', delta: 0 }, 'id'],
];
for (const [t, payload, key] of inserts) {
  const { error } = await sb.from(t).insert(payload);
  add('insert', t, !!error, error ? errText(error) : `WRITE SUCCEEDED, ${key}=${payload[key] ?? 'unknown (serial)'}`, true);
}

// 4. Edge functions: no Authorization header, then the anon key only. Tiny synthetic bodies.
const fns: [string, Record<string, string>][] = [
  ['post_idea', { title: 'redteam-probe' }],
  ['post_idea_v1', { title: 'redteam-probe' }],
  ['checkpoint', { probe: 'redteam-probe' }],
  ['eval_embed', { probe: 'redteam-probe' }],
];
for (const [fn, body] of fns) {
  for (const mode of ['no auth', 'anon key'] as const) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (mode === 'anon key') { headers.apikey = ANON; headers.Authorization = `Bearer ${ANON}`; }
    try {
      const res = await fetch(`${URL_}/functions/v1/${fn}`, { method: 'POST', headers, body: JSON.stringify(body) });
      const text = await res.text();
      let msg = text;
      try { const j = JSON.parse(text); msg = j.status ?? j.error ?? j.message ?? j.msg ?? text; } catch { /* plain text */ }
      add('edge', `${fn} (${mode})`, res.status >= 400, `HTTP ${res.status} ${typeof msg === 'string' ? msg : JSON.stringify(msg)}`);
    } catch (e) {
      add('edge', `${fn} (${mode})`, true, `network error ${(e as Error).message}`);
    }
  }
}

// 5. Storage
{
  const { data, error } = await sb.storage.listBuckets();
  const n = data?.length ?? 0;
  add('storage', 'listBuckets', !!error || n === 0, error ? error.message : `${n} bucket(s)${n ? ': ' + data!.map(b => `${b.name}${b.public ? '(public)' : ''}`).join(',') : ''}`);
  for (const b of data ?? []) {
    const r = await sb.storage.from(b.name).list('', { limit: 5 });
    add('storage', `list ${b.name}`, !!r.error || (r.data?.length ?? 0) === 0, r.error ? r.error.message : `${r.data?.length ?? 0} object(s)`);
  }
  const av = await sb.storage.from('avatars').list('', { limit: 5 });
  add('storage', 'list avatars (guess)', !!av.error || (av.data?.length ?? 0) === 0, av.error ? av.error.message : `${av.data?.length ?? 0} object(s)`);
}

// Report
const w = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '~' : s.padEnd(n));
console.log(`${w('AREA', 8)} ${w('PROBE', 44)} ${w('RESULT', 8)} DETAIL`);
for (const r of rows) console.log(`${w(r.area, 8)} ${w(r.probe, 44)} ${w(r.result, 8)} ${r.detail}`);
const bad = rows.filter(r => r.result !== 'PASS');
console.log(`\n${rows.length} probes, ${rows.length - bad.length} PASS, ${bad.length} not PASS`);
for (const r of bad) console.log(`  ${r.result}: ${r.area} ${r.probe}`);
