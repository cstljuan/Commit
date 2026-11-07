// Authenticated red-team probe: what can a signed-in attacker (qa_mallory) do with the publishable key?
// Run: npx tsx scripts/redteam/authed-probe.mts [--label before|after] [--no-realtime] [--qa-env <path>]
//
// Reads scripts/.env (SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY) and a QA env file
// (default scripts/.env.rls-hardening) holding QA_MALLORY_PASSWORD, QA_VICTIM1_PASSWORD, QA_VICTIM2_PASSWORD.
// Missing QA passwords are generated and appended to that file. Secrets are never printed.
//
// The service role is used only for fixtures and cleanup (QA accounts on qa-commit.dev). Every attack
// runs as qa_mallory with the publishable key. DENIED means an error, or 0 rows affected or returned (F14).
// SMOKE rows check that the app's normal paths still work for the victim accounts.
import { readFileSync, appendFileSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const argVal = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const LABEL = argVal('--label') ?? 'run';
const REALTIME = !args.includes('--no-realtime');
const qaEnvPath = argVal('--qa-env') ?? join(here, '..', '.env.rls-hardening');

function loadEnv(path: string): Record<string, string> {
  const env: Record<string, string> = {};
  if (!existsSync(path)) return env;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
  return env;
}
const env = loadEnv(join(here, '..', '.env'));
const qa = loadEnv(qaEnvPath);
const URL_ = env.SUPABASE_URL;
const PUB = env.SUPABASE_PUBLISHABLE_KEY;
const SECRET = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !PUB || !SECRET) throw new Error('scripts/.env needs SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY');

const scrub = (s: unknown): string =>
  String(s ?? '').split(URL_).join('<project>').split(PUB).join('<pub>').split(SECRET).join('<secret>')
    .replace(/eyJ[A-Za-z0-9_\-.]{20,}/g, '<jwt>').replace(/\s+/g, ' ').slice(0, 90);

// ---------- service role helpers (apikey header only, never Bearer) ----------
async function admin(path: string, init: RequestInit = {}): Promise<any> {
  const res = await fetch(URL_ + path, {
    ...init,
    headers: { apikey: SECRET, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(init.headers as any) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path.split('?')[0]} ${res.status}: ${scrub(text)}`);
  return text ? JSON.parse(text) : null;
}
const rest = (path: string, init: RequestInit = {}) => admin('/rest/v1/' + path, init);

const QA_DOMAIN = 'qa-commit.dev';
const ACCOUNTS = [
  { key: 'mallory', env: 'QA_MALLORY_PASSWORD' },
  { key: 'victim1', env: 'QA_VICTIM1_PASSWORD' },
  { key: 'victim2', env: 'QA_VICTIM2_PASSWORD' },
] as const;
type Key = (typeof ACCOUNTS)[number]['key'];

async function findAuthUser(email: string): Promise<string | null> {
  for (let page = 1; page < 20; page++) {
    const j = await admin(`/auth/v1/admin/users?page=${page}&per_page=200`);
    const list = j.users ?? [];
    const hit = list.find((u: any) => u.email === email);
    if (hit) return hit.id;
    if (list.length < 200) return null;
  }
  return null;
}

async function ensureAccount(key: Key, envName: string): Promise<{ id: string; password: string }> {
  const email = `qa_${key}@${QA_DOMAIN}`;
  let password = qa[envName];
  const fresh = !password;
  if (fresh) {
    password = randomBytes(18).toString('base64url');
    appendFileSync(qaEnvPath, `${envName}=${password}\n`);
    qa[envName] = password;
  }
  let id = await findAuthUser(email);
  if (!id) {
    const j = await admin('/auth/v1/admin/users', { method: 'POST', body: JSON.stringify({ email, password, email_confirm: true }) });
    id = j.id as string;
  } else if (fresh) {
    await admin(`/auth/v1/admin/users/${id}`, { method: 'PUT', body: JSON.stringify({ password }) });
  }
  return { id: id!, password };
}

async function signIn(key: Key, password: string): Promise<SupabaseClient> {
  const c = createClient(URL_, PUB, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await c.auth.signInWithPassword({ email: `qa_${key}@${QA_DOMAIN}`, password });
  if (error) throw new Error(`sign in ${key}: ${error.message}`);
  return c;
}

const b64 = (n: number) => randomBytes(n).toString('base64');
const hex = () => randomBytes(32).toString('hex');
const sig = () => b64(64); // 88 chars ending in ==, the format append_vault_entry checks

// ---------- results ----------
type Verdict = 'DENIED' | 'ALLOWED' | 'INFO' | 'PASS' | 'FAIL';
type Row = { id: string; area: string; probe: string; verdict: Verdict; detail: string };
const rows: Row[] = [];
const add = (id: string, area: string, probe: string, verdict: Verdict, detail: unknown) =>
  rows.push({ id, area, probe, verdict, detail: scrub(detail) });
type PgErr = { code?: string; message?: string } | null;
const errText = (e: PgErr) => (e ? `${e.code ?? ''} ${e.message ?? ''}`.trim() : '');

async function main() {
  // ---------- accounts and fixtures ----------
  const ids = {} as Record<Key, string>;
  const pw = {} as Record<Key, string>;
  for (const a of ACCOUNTS) {
    const r = await ensureAccount(a.key, a.env);
    ids[a.key] = r.id;
    pw[a.key] = r.password;
  }
  for (const a of ACCOUNTS) {
    // Service role fixture: plain profiles, never Women mode. Mallory gets a signing key so she can append to the vault.
    const row: Record<string, unknown> = {
      id: ids[a.key], name: `qa_${a.key}`, username: `qa_${a.key}`, primary_role: 'Backend', women_only: false,
    };
    await rest('profiles?on_conflict=id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(row) });
  }
  const [mp] = await rest(`profiles?select=sign_public_key&id=eq.${ids.mallory}`);
  if (!mp.sign_public_key) {
    await rest(`profiles?id=eq.${ids.mallory}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ sign_public_key: b64(32) }) });
  }

  async function ensureProject(owner: Key, title: string, extra: Record<string, unknown>): Promise<string> {
    const found = await rest(`projects?select=id&owner_id=eq.${ids[owner]}&title=eq.${encodeURIComponent(title)}`);
    if (found.length) return found[0].id;
    const [p] = await rest('projects', {
      method: 'POST',
      body: JSON.stringify({ owner_id: ids[owner], title, short_pitch: 'qa fixture', type: 'original', visibility: 'private', hidden: true, ...extra }),
    });
    await rest('team_members', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ project_id: p.id, user_id: ids[owner], role: 'Backend', ownership: 'owner' }) });
    return p.id;
  }
  // P1: victim1's hidden private project with ciphertext. PM: mallory's own hidden project (vault target).
  const P1 = await ensureProject('victim1', 'qa-rls victim1 hidden', { idea_cipher: b64(48), idea_nonce: b64(24) });
  const PM = await ensureProject('mallory', 'qa-rls mallory own', {});
  let [M] = await rest(`matches?select=id&project_id=eq.${P1}&user_id=eq.${ids.victim2}`);
  if (!M) [M] = await rest('matches', { method: 'POST', body: JSON.stringify({ project_id: P1, user_id: ids.victim2, role: 'Backend' }) });
  const MID = M.id as string;
  const msgs = await rest(`match_messages?select=id&match_id=eq.${MID}&limit=1`);
  if (!msgs.length) await rest('match_messages', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ match_id: MID, sender_id: ids.victim2, body: 'qa fixture message' }) });
  let [S] = await rest(`swipes?select=id&swiper_id=eq.${ids.victim2}&target_id=eq.${P1}`);
  if (!S) [S] = await rest('swipes', { method: 'POST', body: JSON.stringify({ swiper_id: ids.victim2, target_id: P1, target_type: 'project', project_id: P1, role: 'Backend', direction: 'right' }) });
  const SID = S.id as string;
  // A real private project with ciphertext that mallory is not on (seeded demo data).
  const [demoPrivate] = await rest(`projects?select=id&idea_cipher=not.is.null&hidden=is.false&owner_id=neq.${ids.mallory}&limit=1`);

  const mallory = await signIn('mallory', pw.mallory);
  const v1 = await signIn('victim1', pw.victim1);
  const v2 = await signIn('victim2', pw.victim2);
  const me = ids.mallory;

  // ---------- attacks as qa_mallory ----------

  // 1. Women mode self-grant
  {
    const { data, error } = await mallory.from('profiles').update({ women_only: true }).eq('id', me).select('women_only');
    const on = !error && data?.length === 1 && data[0].women_only === true;
    let deck = '';
    if (on) {
      const d = await mallory.rpc('get_deck', { p_mode: 'women' });
      deck = `, women deck returned ${Array.isArray(d.data) ? d.data.length : 0} card(s)`;
    }
    add('1a', 'women', 'turn on women_only for myself (update)', on ? 'ALLOWED' : 'DENIED', error ? errText(error) : `women_only=${data?.[0]?.women_only}${deck}`);
    const up = await mallory.from('profiles').upsert({ id: me, name: 'qa_mallory', women_only: true }, { onConflict: 'id' }).select('women_only');
    const on2 = !up.error && up.data?.[0]?.women_only === true;
    add('1b', 'women', 'turn on women_only via upsert (saveProfile path)', on2 ? 'ALLOWED' : 'DENIED', up.error ? errText(up.error) : `women_only=${up.data?.[0]?.women_only}`);
    const [stored] = await rest(`profiles?select=women_only&id=eq.${me}`);
    const wd = await mallory.rpc('get_deck', { p_mode: 'women' });
    const wn = Array.isArray(wd.data) ? wd.data.length : 0;
    add('1d', 'women', 'women_only stored after both tries / women deck', stored.women_only || wn > 0 ? 'ALLOWED' : 'DENIED', `stored women_only=${stored.women_only}, women deck ${wd.error ? errText(wd.error) : wn + ' card(s)'}`);
    await rest(`profiles?id=eq.${me}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ women_only: false }) });
  }
  {
    const { data, error } = await mallory.from('projects')
      .insert({ owner_id: me, title: 'qa-rls women project by non-member', short_pitch: 'qa', women_only: true, hidden: true }).select('id');
    const ok = !error && !!data?.length;
    add('1c', 'women', 'post a women_only project without Women mode', ok ? 'ALLOWED' : 'DENIED', error ? errText(error) : `created ${data?.length} row(s)`);
    if (ok) await rest(`projects?id=eq.${data![0].id}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
  }

  // 2. Vault timestamps. A successful append is removed right away if it is still the chain head.
  async function tryAppend(id: string, probe: string, ts: string) {
    const { data, error } = await mallory.rpc('append_vault_entry', { p_project: PM, p_idea_hash: hex(), p_ts: ts, p_sig: sig() });
    const row = data as { seq?: number } | null;
    const ok = !error && !!row?.seq;
    let cleanup = '';
    if (ok) {
      const [head] = await rest('vault_log?select=seq&order=seq.desc&limit=1');
      if (head?.seq === row!.seq) {
        await rest(`vault_log?seq=eq.${row!.seq}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
        cleanup = ', removed (was chain head)';
      } else cleanup = ', NOT removed (no longer chain head)';
    }
    add(id, 'vault', probe, ok ? 'ALLOWED' : 'DENIED', error ? errText(error) : `appended seq ${row?.seq}${cleanup}`);
  }
  await tryAppend('2a', 'append_vault_entry backdated to 2020-01-01', '2020-01-01T00:00:00.000Z');
  await tryAppend('2b', 'append_vault_entry 1 day in the future', new Date(Date.now() + 86400_000).toISOString());
  await tryAppend('2c', 'append_vault_entry 10 min in the past', new Date(Date.now() - 600_000).toISOString());
  {
    // Smoke: an honest append with the current time still works (removed again if it is the chain head).
    const { data, error } = await mallory.rpc('append_vault_entry', { p_project: PM, p_idea_hash: hex(), p_ts: new Date().toISOString(), p_sig: sig() });
    const row = data as { seq?: number } | null;
    if (row?.seq) {
      const [head] = await rest('vault_log?select=seq&order=seq.desc&limit=1');
      if (head?.seq === row.seq) await rest(`vault_log?seq=eq.${row.seq}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
    }
    add('S0', 'smoke', 'append_vault_entry with the current time', !error && !!row?.seq ? 'PASS' : 'FAIL', error ? errText(error) : `appended seq ${row?.seq}`);
  }
  {
    const { error } = await mallory.from('vault_log').insert({ project_id: PM, author_id: me, idea_hash: hex(), ts: new Date().toISOString(), author_sig: sig(), prev_hash: hex(), entry_hash: hex() });
    add('2d', 'vault', 'insert a forged vault_log row directly', error ? 'DENIED' : 'ALLOWED', error ? errText(error) : 'row inserted');
    const upd = await mallory.from('vault_log').update({ ts: '2020-01-01T00:00:00Z' }).eq('author_id', me).select('seq');
    add('2e', 'vault', 'update my own vault_log rows', upd.error || !upd.data?.length ? 'DENIED' : 'ALLOWED', upd.error ? errText(upd.error) : `${upd.data?.length ?? 0} row(s)`);
  }

  // 3. Project ciphertext and hidden rows
  if (demoPrivate) {
    const { data, error } = await mallory.from('projects').select('id, idea_cipher, idea_nonce').eq('id', demoPrivate.id);
    const leak = !error && !!data?.[0]?.idea_cipher;
    add('3a', 'projects', 'read idea_cipher/idea_nonce of a team I am not on', leak ? 'ALLOWED' : 'DENIED', error ? errText(error) : `${data?.length ?? 0} row(s), cipher ${leak ? 'returned' : 'absent'}`);
  } else add('3a', 'projects', 'read idea_cipher of a team I am not on', 'INFO', 'no non-hidden private project found');
  {
    const { data, error } = await mallory.from('projects').select('*').eq('id', P1);
    add('3b', 'projects', 'select * on another user\'s hidden project', error || !data?.length ? 'DENIED' : 'ALLOWED', error ? errText(error) : `${data?.length} row(s)`);
    const t = await mallory.from('projects').select('id, title').eq('id', P1);
    add('3c', 'projects', 'read title of another user\'s hidden project', t.error || !t.data?.length ? 'DENIED' : 'ALLOWED', t.error ? errText(t.error) : `${t.data?.length} row(s)`);
    const r = await mallory.rpc('project_idea', { p: P1 });
    const got = !r.error && Array.isArray(r.data) && r.data.length > 0;
    add('3d', 'projects', 'project_idea() on a team I am not on', got ? 'ALLOWED' : 'DENIED', r.error ? errText(r.error) : `${(r.data as unknown[] | null)?.length ?? 0} row(s)`);
  }

  // 4. Direct swipe writes (skip record_swipe and its Super Commit limit)
  {
    const { data, error } = await mallory.from('swipes')
      .insert({ swiper_id: me, target_id: P1, target_type: 'project', project_id: P1, role: 'qa-probe', direction: 'right', is_super: true }).select('id');
    const ok = !error && !!data?.length;
    add('4a', 'swipes', 'insert a Super swipe directly (no daily limit)', ok ? 'ALLOWED' : 'DENIED', error ? errText(error) : `${data?.length} row(s)`);
    if (ok) {
      const upd = await mallory.from('swipes').update({ is_super: true, direction: 'right' }).eq('id', data![0].id).select('id');
      add('4b', 'swipes', 'update my own swipe directly', upd.error || !upd.data?.length ? 'DENIED' : 'ALLOWED', upd.error ? errText(upd.error) : `${upd.data?.length} row(s)`);
      const del = await mallory.from('swipes').delete().eq('id', data![0].id).select('id');
      add('4c', 'swipes', 'delete my own swipe directly', del.error || !del.data?.length ? 'DENIED' : 'ALLOWED', del.error ? errText(del.error) : `${del.data?.length} row(s)`);
      await rest(`swipes?id=eq.${data![0].id}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
    } else {
      // Insert is closed. Check update and delete on a real swipe of hers made through the RPC.
      const rs = await mallory.rpc('record_swipe', { p_target_id: P1, p_target_type: 'project', p_project_id: P1, p_role: 'qa-probe', p_direction: 'left' });
      const [own] = await rest(`swipes?select=id&swiper_id=eq.${me}&target_id=eq.${P1}`);
      if (rs.error || !own) add('4b', 'swipes', 'update my own swipe directly', 'INFO', `could not create a swipe via RPC: ${errText(rs.error)}`);
      else {
        const upd = await mallory.from('swipes').update({ is_super: true, direction: 'right' }).eq('id', own.id).select('id');
        add('4b', 'swipes', 'update my own swipe directly', upd.error || !upd.data?.length ? 'DENIED' : 'ALLOWED', upd.error ? errText(upd.error) : `${upd.data?.length} row(s)`);
        const del = await mallory.from('swipes').delete().eq('id', own.id).select('id');
        add('4c', 'swipes', 'delete my own swipe directly', del.error || !del.data?.length ? 'DENIED' : 'ALLOWED', del.error ? errText(del.error) : `${del.data?.length} row(s)`);
        await rest(`swipes?id=eq.${own.id}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
      }
    }
    const others = await mallory.from('swipes').select('id').eq('swiper_id', ids.victim2);
    add('4d', 'swipes', 'read another user\'s swipes', others.error || !others.data?.length ? 'DENIED' : 'ALLOWED', others.error ? errText(others.error) : `${others.data?.length} row(s)`);
  }

  // 5. Women enumeration surface (assessed, reported as INFO)
  {
    const k = await mallory.rpc('vault_signing_keys');
    add('5a', 'women', 'vault_signing_keys() rows visible', 'INFO', k.error ? errText(k.error) : `${(k.data as unknown[] | null)?.length ?? 0} author key(s), ids only, no names`);
    const p = await mallory.from('profiles').select('id').eq('women_only', true);
    add('5b', 'women', 'list Women mode profiles', p.error || !p.data?.length ? 'DENIED' : 'ALLOWED', p.error ? errText(p.error) : `${p.data?.length} row(s)`);
  }

  // 6. copy_alerts copier identity
  {
    const { data, error } = await mallory.from('copy_alerts').select('id, copier_id').limit(1);
    add('6a', 'alerts', 'select copy_alerts.copier_id', error ? 'DENIED' : data?.length ? 'ALLOWED' : 'DENIED', error ? errText(error) : `${data?.length} row(s)`);
  }

  // Live checks
  for (const col of ['box_public_key', 'sign_public_key'] as const) {
    const { data, error } = await mallory.from('profiles').update({ [col]: b64(32) }).eq('id', ids.victim1).select('id');
    add(col === 'box_public_key' ? 'L1' : 'L2', 'profiles', `update victim's ${col}`, error || !data?.length ? 'DENIED' : 'ALLOWED', error ? errText(error) : `${data?.length} row(s)`);
  }
  {
    const r = await mallory.from('match_messages').select('id, body').eq('match_id', MID);
    add('L3', 'chat', 'read match_messages of a match I am not in', r.error || !r.data?.length ? 'DENIED' : 'ALLOWED', r.error ? errText(r.error) : `${r.data?.length} row(s)`);
    const i = await mallory.from('match_messages').insert({ match_id: MID, sender_id: me, body: 'qa-probe' }).select('id');
    add('L4', 'chat', 'insert into a match I am not in', i.error || !i.data?.length ? 'DENIED' : 'ALLOWED', i.error ? errText(i.error) : `${i.data?.length} row(s)`);
    const spoof = await mallory.from('match_messages').insert({ match_id: MID, sender_id: ids.victim2, body: 'qa-probe' }).select('id');
    add('L5', 'chat', 'insert as victim2 (spoofed sender_id)', spoof.error || !spoof.data?.length ? 'DENIED' : 'ALLOWED', spoof.error ? errText(spoof.error) : `${spoof.data?.length} row(s)`);
    const m = await mallory.from('matches').select('id').eq('id', MID);
    add('L6', 'matches', 'read a match I am not in', m.error || !m.data?.length ? 'DENIED' : 'ALLOWED', m.error ? errText(m.error) : `${m.data?.length} row(s)`);
  }
  {
    const r = await mallory.from('reliability_events').insert({ user_id: me, label: 'qa-probe', delta: 30 }).select('id');
    add('L7', 'score', 'insert reliability_events', r.error || !r.data?.length ? 'DENIED' : 'ALLOWED', r.error ? errText(r.error) : `${r.data?.length} row(s)`);
    const u = await mallory.from('reliability_events').update({ delta: 30 }).eq('user_id', me).select('id');
    add('L8', 'score', 'update my reliability_events', u.error || !u.data?.length ? 'DENIED' : 'ALLOWED', u.error ? errText(u.error) : `${u.data?.length ?? 0} row(s)`);
    const s = await mallory.from('profiles').update({ reliability_score: 100 }).eq('id', me).select('reliability_score');
    add('L9', 'score', 'raise my own reliability_score', s.error || !s.data?.length ? 'DENIED' : 'ALLOWED', s.error ? errText(s.error) : `score=${s.data?.[0]?.reliability_score}`);
    const a = await mallory.rpc('adjust_reliability', { p_user: me, p_event: 'completed' });
    add('L10', 'score', 'call adjust_reliability', a.error ? 'DENIED' : 'ALLOWED', a.error ? errText(a.error) : `returned ${a.data}`);
  }
  {
    const r = await mallory.rpc('respond_interested', { p_swipe_ref: SID, p_like: true });
    add('L11', 'likes', 'respond_interested on someone else\'s card', r.error ? 'DENIED' : 'ALLOWED', r.error ? errText(r.error) : JSON.stringify(r.data));
  }
  {
    const { data: s } = await mallory.auth.getSession();
    const tok = s.session!.access_token;
    for (const [id, label, headers] of [
      ['L12', 'auth admin list users (publishable key + my JWT)', { apikey: PUB, Authorization: `Bearer ${tok}` }],
      ['L13', 'auth admin list users (publishable key only)', { apikey: PUB }],
    ] as const) {
      const res = await fetch(`${URL_}/auth/v1/admin/users?per_page=5`, { headers: headers as Record<string, string> });
      const text = await res.text();
      const leaked = res.ok && /@/.test(text);
      add(id, 'emails', label, leaked ? 'ALLOWED' : 'DENIED', `HTTP ${res.status}`);
    }
    const e = await mallory.from('profiles').select('id, email').limit(1);
    add('L14', 'emails', 'select profiles.email', e.error ? 'DENIED' : 'ALLOWED', e.error ? errText(e.error) : `${e.data?.length} row(s)`);
  }
  {
    const r = await mallory.from('team_keys').insert({ project_id: P1, user_id: me, encrypted_team_key: b64(48), nonce: b64(24), sender_public_key: b64(32) }).select('project_id');
    add('L15', 'keys', 'insert a team key into a project I do not own', r.error || !r.data?.length ? 'DENIED' : 'ALLOWED', r.error ? errText(r.error) : `${r.data?.length} row(s)`);
    const t = await mallory.from('team_members').insert({ project_id: P1, user_id: me, role: 'Backend', ownership: 'collaborator' }).select('project_id');
    add('L16', 'team', 'add myself to a team', t.error || !t.data?.length ? 'DENIED' : 'ALLOWED', t.error ? errText(t.error) : `${t.data?.length} row(s)`);
    const c = await mallory.rpc('commit_to_project', { p_match_id: MID });
    add('L17', 'team', 'commit_to_project on a match I am not in', c.error ? 'DENIED' : 'ALLOWED', c.error ? errText(c.error) : JSON.stringify(c.data));
  }

  // ---------- Realtime: does a copy alert's payload carry copier_id? ----------
  if (REALTIME) await realtimeCheck(v1, mallory, ids);

  // ---------- smoke: the app's normal paths still work ----------
  const pass = (id: string, probe: string, ok: boolean, detail: unknown) => add(id, 'smoke', probe, ok ? 'PASS' : 'FAIL', detail);
  {
    const d = await v2.rpc('get_deck', { p_mode: 'normal' });
    pass('S1', 'victim2 get_deck(normal)', !d.error && Array.isArray(d.data), d.error ? errText(d.error) : `${(d.data as unknown[]).length} card(s)`);
    const w = await v2.rpc('get_deck', { p_mode: 'women' });
    pass('S2', 'victim2 get_deck(women) is empty for non-members', !w.error && Array.isArray(w.data) && (w.data as unknown[]).length === 0, w.error ? errText(w.error) : `${(w.data as unknown[]).length} card(s)`);
    const h = await v2.rpc('get_deck', { p_mode: 'hack' });
    pass('S3', 'victim2 get_deck(hack)', !h.error && Array.isArray(h.data), h.error ? errText(h.error) : `${(h.data as unknown[]).length} card(s)`);
    const r = await v2.rpc('record_swipe', { p_target_id: PM, p_target_type: 'project', p_project_id: PM, p_role: 'Backend', p_direction: 'left' });
    pass('S4', 'victim2 record_swipe(left)', !r.error, r.error ? errText(r.error) : JSON.stringify(r.data));
    const u = await v2.rpc('undo_last_swipe');
    pass('S5', 'victim2 undo_last_swipe', !u.error, u.error ? errText(u.error) : 'ok');
    const sc = await v2.rpc('super_commits_left');
    pass('S6', 'victim2 super_commits_left', !sc.error, sc.error ? errText(sc.error) : `left=${sc.data}`);
    const gi = await v1.rpc('get_interested');
    pass('S7', 'victim1 get_interested', !gi.error, gi.error ? errText(gi.error) : 'ok');
  }
  {
    // getMatches query shape, from the matched user's side (P1 is hidden) and from the owner's side.
    const sel = 'id, project_id, user_id, role, owner_committed, user_committed, created_at, project:projects(owner_id, type, title)';
    const a = await v2.from('matches').select(sel).eq('id', MID);
    const pa = (a.data?.[0] as any)?.project;
    pass('S8', 'victim2 getMatches query sees project owner', !a.error && pa?.owner_id === ids.victim1, a.error ? errText(a.error) : `owner ${pa?.owner_id ? 'present' : 'missing'}`);
    const b = await v1.from('matches').select(sel).eq('id', MID);
    pass('S9', 'victim1 getMatches query (owner side)', !b.error && b.data?.length === 1, b.error ? errText(b.error) : `${b.data?.length} row(s)`);
  }
  {
    const body = `qa smoke ${new Date().toISOString()}`;
    const i = await v2.from('match_messages').insert({ match_id: MID, sender_id: ids.victim2, body }).select('id');
    pass('S10', 'victim2 match_messages insert', !i.error && i.data?.length === 1, i.error ? errText(i.error) : 'ok');
    const s = await v1.from('match_messages').select('id, match_id, sender_id, body, created_at').eq('match_id', MID).order('created_at');
    pass('S11', 'victim1 match_messages select', !s.error && !!s.data?.some((m) => m.body === body), s.error ? errText(s.error) : `${s.data?.length} row(s)`);
    const long = await v2.from('match_messages').insert({ match_id: MID, sender_id: ids.victim2, body: 'e2e1.' + 'A'.repeat(11000) }).select('id');
    pass('S12', 'victim2 11000-char encrypted-size message accepted', !long.error, long.error ? errText(long.error) : 'ok');
    const huge = await v2.from('match_messages').insert({ match_id: MID, sender_id: ids.victim2, body: 'A'.repeat(13000) }).select('id');
    add('S13', 'smoke', 'victim2 13000-char message (rejected once length check ships)', huge.error ? 'DENIED' : 'ALLOWED', huge.error ? errText(huge.error) : 'accepted');
    await rest(`match_messages?match_id=eq.${MID}&body=neq.qa%20fixture%20message`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
  }
  {
    // getMyProjects and getTeam query shapes, then the members-only idea function.
    const own = await v1.from('projects').select('id').eq('owner_id', ids.victim1);
    pass('S14', 'victim1 getMyProjects owned ids', !own.error && !!own.data?.some((p) => p.id === P1), own.error ? errText(own.error) : `${own.data?.length} row(s)`);
    const rows_ = await v1.from('projects').select('id, owner_id, title, short_pitch, type, visibility, idea_public, hidden, created_at').in('id', [P1]);
    pass('S15', 'victim1 getMyProjects detail columns', !rows_.error && rows_.data?.length === 1, rows_.error ? errText(rows_.error) : `${rows_.data?.length} row(s)`);
    const team = await v1.from('projects').select('id, title, type').eq('id', P1).single();
    pass('S16', 'victim1 getTeam project row', !team.error, team.error ? errText(team.error) : 'ok');
    const idea = await v1.rpc('project_idea', { p: P1 });
    const row = (idea.data as { idea_cipher?: string }[] | null)?.[0];
    pass('S17', 'victim1 project_idea() returns own ciphertext', !idea.error && !!row?.idea_cipher, idea.error ? errText(idea.error) : `${(idea.data as unknown[] | null)?.length ?? 0} row(s)`);
    const al = await v1.from('copy_alerts').select('id, original_project_id, similarity, created_at, project:projects(title)');
    pass('S18', 'victim1 getCopyAlerts query', !al.error, al.error ? errText(al.error) : `${al.data?.length} row(s)`);
    const prof = await v2.from('profiles').upsert({ id: ids.victim2, name: 'qa_victim2', username: 'qa_victim2', bio: 'qa smoke', primary_role: 'Backend' }, { onConflict: 'id' });
    pass('S19', 'victim2 saveProfile upsert without women_only', !prof.error, prof.error ? errText(prof.error) : 'ok');
    // The exact payload the deployed app (cstljuan/wire saveProfile) sends, women_only included.
    const wire = await v2.from('profiles').upsert({
      id: ids.victim2, name: 'qa_victim2', username: 'qa_victim2', avatar_url: null, bio: 'qa smoke', primary_role: 'Backend',
      level: 'intermediate', occupation: 'student', skills: ['Go'], prompts: [], hours_per_week: 10, timezone: 'America/New_York',
      women_only: true,
    }, { onConflict: 'id' });
    const [w2] = await rest(`profiles?select=women_only&id=eq.${ids.victim2}`);
    pass('S19b', 'victim2 wire-app upsert with women_only:true saves, flag stays false', !wire.error && w2.women_only === false, wire.error ? errText(wire.error) : `stored women_only=${w2.women_only}`);
    const me2 = await v2.from('profiles').select('*').eq('id', ids.victim2).maybeSingle();
    pass('S20', 'victim2 getMyProfile select *', !me2.error && !!me2.data, me2.error ? errText(me2.error) : 'ok');
    const vl = await v1.from('vault_log').select('seq, project_id, ts').eq('author_id', ids.victim1).limit(1);
    pass('S21', 'victim1 getActivity vault_log query', !vl.error, vl.error ? errText(vl.error) : 'ok');
    const ev = await v1.from('reliability_events').select('label, delta, created_at').eq('user_id', ids.victim1);
    pass('S22', 'victim1 getScore reliability_events query', !ev.error, ev.error ? errText(ev.error) : 'ok');
  }

  // ---------- report ----------
  const w = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '~' : s.padEnd(n));
  console.log(`authed-probe (${LABEL}) as qa_mallory, publishable key\n`);
  console.log(`${w('ID', 4)} ${w('AREA', 8)} ${w('PROBE', 52)} ${w('RESULT', 8)} DETAIL`);
  for (const r of rows) console.log(`${w(r.id, 4)} ${w(r.area, 8)} ${w(r.probe, 52)} ${w(r.verdict, 8)} ${r.detail}`);
  const allowed = rows.filter((r) => r.verdict === 'ALLOWED' && r.area !== 'smoke');
  const failed = rows.filter((r) => r.verdict === 'FAIL');
  console.log(`\n${rows.length} rows: ${allowed.length} attack(s) ALLOWED, ${failed.length} smoke FAIL`);
  for (const r of [...allowed, ...failed]) console.log(`  ${r.verdict}: ${r.id} ${r.probe}`);
  await Promise.all([mallory, v1, v2].map((c) => c.removeAllChannels()));
  process.exit(0);
}

async function realtimeCheck(owner: SupabaseClient, attacker: SupabaseClient, ids: Record<Key, string>) {
  // victim1 posts one hidden public idea through post_idea (v2) once; mallory posts a near copy through
  // post_idea_v1 each run. Both stay hidden so nothing reaches the demo decks.
  const idea = 'QA RLS fixture: a mesh network of tide gauges built from recycled phones that texts fishing crews ' +
    'when the harbour bar becomes unsafe, with a solar charging dock and an offline map of safe channels.';
  const title = 'qa-rls realtime original';
  let [orig] = await rest(`projects?select=id&owner_id=eq.${ids.victim1}&title=eq.${encodeURIComponent(title)}`);
  const invoke = async (c: SupabaseClient, fn: string, body: Record<string, unknown>) => {
    const { data: s } = await c.auth.getSession();
    const res = await fetch(`${URL_}/functions/v1/${fn}`, {
      method: 'POST', headers: { apikey: PUB, Authorization: `Bearer ${s.session!.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { status: res.status, json: await res.json().catch(() => ({})) as any };
  };
  if (!orig) {
    const r = await invoke(owner, 'post_idea', { title, shortPitch: 'qa fixture', visibility: 'public', hidden: true, fullIdea: idea });
    if (!r.json.projectId) { add('6b', 'alerts', 'Realtime copy alert payload', 'INFO', `fixture post failed: HTTP ${r.status} ${r.json.status ?? ''}`); return; }
    orig = { id: r.json.projectId };
  }
  await rest(`copy_alerts?original_project_id=eq.${orig.id}&copier_id=eq.${ids.mallory}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });

  let payload: Record<string, unknown> | null = null;
  let status = '';
  const channel = owner.channel(`qa-alerts-${Date.now()}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'copy_alerts', filter: `owner_id=eq.${ids.victim1}` }, (p) => { payload = p.new as Record<string, unknown>; })
    .subscribe((s) => { status = s; });
  for (let i = 0; i < 40 && status !== 'SUBSCRIBED'; i++) await new Promise((r) => setTimeout(r, 250));
  await new Promise((r) => setTimeout(r, 1500));
  const copy = await invoke(attacker, 'post_idea_v1', {
    title: 'qa-rls realtime copy', shortPitch: 'qa', visibility: 'public', hidden: true,
    fullIdea: idea.replace('recycled phones', 'old recycled phones'),
  });
  for (let i = 0; i < 40 && !payload; i++) await new Promise((r) => setTimeout(r, 250));
  owner.removeChannel(channel);
  if (copy.json.projectId) await rest(`projects?id=eq.${copy.json.projectId}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
  const [alert] = await rest(`copy_alerts?select=id&original_project_id=eq.${orig.id}&copier_id=eq.${ids.mallory}`);
  if (!payload) {
    add('6b', 'alerts', 'Realtime copy alert payload carries copier_id', 'INFO',
      `no event (channel ${status}, v1 HTTP ${copy.status}, alert row ${alert ? 'created' : 'missing'}, similarity ${copy.json.similarity ?? 'n/a'})`);
    return;
  }
  const p = payload as Record<string, unknown>;
  const leaked = 'copier_id' in p && p.copier_id != null;
  add('6b', 'alerts', 'Realtime copy alert payload carries copier_id', leaked ? 'ALLOWED' : 'DENIED',
    `event keys: ${Object.keys(p).sort().join(',')}${leaked ? (p.copier_id === ids.mallory ? ' (copier_id = mallory)' : '') : ''}`);
}

main().catch((e) => { console.error(scrub((e as Error).message)); process.exit(1); });
