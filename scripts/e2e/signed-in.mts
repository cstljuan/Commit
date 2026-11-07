// Signed-in end-to-end harness against the hosted Supabase project.
//   npx tsx scripts/e2e/signed-in.mts
//
// Proves, as real signed-in users with the publishable key, what the app does through lib/api.real.ts:
// profile, device keys, private post through post_idea v2, deck, swipes, match, commit, team key sharing,
// encrypted chat (lib/e2eeCore.ts), Realtime, Who wants you, hack roles, activity, score, vault chain.
//
// Accounts: three dedicated QA users on @qa-commit.dev (qa_alice, qa_bob, qa_eve), never the demo accounts.
// Secrets live outside git, in the main checkout's scripts folder:
//   scripts/.env.e2e-harness     QA_ALICE_EMAIL / QA_ALICE_PASSWORD, etc. (created on first run)
//   scripts/.env.e2e-keys.json   NaCl secret keys per QA user id (keys cannot be replaced once set, F11)
// The service key (scripts/.env) is only used for account admin and for cleanup scoped to QA user ids.
// Projects with vault entries cannot be deleted (F3): the harness keeps one hidden vault project for
// qa_alice and reuses it on the next run, so repeated runs do not pile up projects.

import { createHash, randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import nacl from 'tweetnacl';
import naclUtil from 'tweetnacl-util';

import { open, seal } from '../../lib/e2eeCore.ts';

const { encodeBase64, decodeBase64, decodeUTF8, encodeUTF8 } = naclUtil;

// ---------- paths and env ----------

const here = dirname(fileURLToPath(import.meta.url));
const localScripts = join(here, '..');
// In a git worktree (.claude/worktrees/<name>), secrets stay in the main checkout's scripts folder.
const wt = localScripts.replace(/\\/g, '/').match(/^(.*)\/\.claude\/worktrees\/[^/]+\/scripts$/);
const secretsDir = process.env.QA_SECRETS_DIR ?? (wt ? join(wt[1], 'scripts') : localScripts);
const QA_ENV = join(secretsDir, '.env.e2e-harness');
const QA_KEYS = join(secretsDir, '.env.e2e-keys.json');
const QA_DOMAIN = 'qa-commit.dev';

function readEnv(path: string): Record<string, string> {
  const env: Record<string, string> = {};
  if (!existsSync(path)) return env;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

const env = { ...readEnv(join(secretsDir, '.env')), ...readEnv(join(localScripts, '.env')) };
const URL_ = env.SUPABASE_URL;
const ANON = env.SUPABASE_PUBLISHABLE_KEY;
const SECRET = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !ANON || !SECRET) throw new Error('scripts/.env needs SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY');

// ---------- service helpers (apikey header only, never as a bearer) ----------

async function admin(path: string, init: RequestInit = {}): Promise<any> {
  const res = await fetch(URL_ + path, {
    ...init,
    headers: { apikey: SECRET, 'Content-Type': 'application/json', ...(init.headers as Record<string, string>) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path.split('?')[0]} ${res.status}: ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}
const svc = (path: string, init: RequestInit = {}) =>
  admin('/rest/v1/' + path, { ...init, headers: { Prefer: 'return=representation', ...(init.headers as Record<string, string>) } });
const inList = (ids: string[]) => `in.(${ids.join(',')})`;

// ---------- results ----------

type Row = { step: string; ok: boolean; detail: string };
const results: Row[] = [];
const notes: string[] = [];

async function check(step: string, fn: () => Promise<string | void>): Promise<boolean> {
  try {
    const detail = (await fn()) ?? '';
    results.push({ step, ok: true, detail });
    return true;
  } catch (e) {
    results.push({ step, ok: false, detail: (e as Error).message.replace(/\s+/g, ' ').slice(0, 160) });
    return false;
  }
}
function must(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(message);
}
/** Stops the run when a step that everything after it depends on has failed, instead of cascading. */
function gate(isPrereq: (step: string) => boolean): void {
  const bad = results.find((r) => !r.ok && isPrereq(r.step));
  if (bad) throw new Error(`blocked by failed step "${bad.step}"`);
}
function fail(error:{ message: string; code?: string } | null | undefined, what: string): void {
  if (error) throw new Error(`${what}: ${error.message}${error.code ? ` (${error.code})` : ''}`);
}

// ---------- accounts ----------

type QaKey = 'alice' | 'bob' | 'eve';
const QA_KEYS_LIST: QaKey[] = ['alice', 'bob', 'eve'];
type Secrets = { box: string; sign: string };
type Qa = {
  key: QaKey; id: string; email: string; password: string; username: string;
  client: SupabaseClient; boxPub: string; boxSec: Uint8Array; signPub: string; signSec: Uint8Array;
};

const qaEnv = readEnv(QA_ENV);
const keyStore: Record<string, Secrets> = existsSync(QA_KEYS) ? JSON.parse(readFileSync(QA_KEYS, 'utf8')) : {};
const saveQaEnv = () =>
  writeFileSync(QA_ENV, Object.entries(qaEnv).map(([k, v]) => `${k}=${v}`).join('\n') + '\n', { mode: 0o600 });
const saveKeys = () => writeFileSync(QA_KEYS, JSON.stringify(keyStore, null, 2), { mode: 0o600 });

async function qaAuthUsers(): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (let page = 1; page < 50; page++) {
    const j = await admin(`/auth/v1/admin/users?page=${page}&per_page=200`);
    const list = j.users ?? [];
    for (const u of list) if (String(u.email ?? '').endsWith('@' + QA_DOMAIN)) out.set(u.email, u.id);
    if (list.length < 200) break;
  }
  return out;
}

async function createAuthUser(email: string, password: string): Promise<string> {
  const j = await admin('/auth/v1/admin/users', { method: 'POST', body: JSON.stringify({ email, password, email_confirm: true }) });
  return j.id;
}

/** Creates the three QA users if missing (idempotent). Recreates one whose keys are set but whose secret is lost. */
async function ensureAccounts(): Promise<{ key: QaKey; id: string; email: string; password: string }[]> {
  const existing = await qaAuthUsers();
  const out: { key: QaKey; id: string; email: string; password: string }[] = [];
  for (const key of QA_KEYS_LIST) {
    const K = key.toUpperCase();
    let email = qaEnv[`QA_${K}_EMAIL`] ?? `qa_${key}@${QA_DOMAIN}`;
    let password = qaEnv[`QA_${K}_PASSWORD`];
    let id = existing.get(email);
    if (!password) {
      password = randomBytes(18).toString('base64url');
      qaEnv[`QA_${K}_PASSWORD`] = password;
      if (id) await admin(`/auth/v1/admin/users/${id}`, { method: 'PUT', body: JSON.stringify({ password }) });
    }
    qaEnv[`QA_${K}_EMAIL`] = email;
    saveQaEnv();
    if (!id) id = await createAuthUser(email, password);

    // F11: registered keys cannot be replaced. If this run cannot hold the secret, start a fresh user.
    const [prof] = await svc(`profiles?select=box_public_key,sign_public_key&id=eq.${id}`);
    const local = keyStore[id];
    const matches = local && prof &&
      encodeBase64(nacl.box.keyPair.fromSecretKey(decodeBase64(local.box)).publicKey) === prof.box_public_key &&
      encodeBase64(nacl.sign.keyPair.fromSecretKey(decodeBase64(local.sign)).publicKey) === prof.sign_public_key;
    if (prof && (prof.box_public_key || prof.sign_public_key) && !matches) {
      try {
        await svc(`projects?owner_id=eq.${id}`, { method: 'DELETE' });
        await admin(`/auth/v1/admin/users/${id}`, { method: 'DELETE' });
      } catch {
        // Vault rows block deletion (F3). Use a new address instead.
        const n = Number((email.match(/_r(\d+)@/) ?? [])[1] ?? 1) + 1;
        email = `qa_${key}_r${n}@${QA_DOMAIN}`;
        qaEnv[`QA_${K}_EMAIL`] = email;
        saveQaEnv();
      }
      id = await createAuthUser(email, password);
      notes.push(`recreated QA user ${key} (secret key was lost)`);
    }
    out.push({ key, id, email, password });
  }
  return out;
}

// ---------- cleanup, scoped to QA user ids ----------

async function cleanup(ids: string[]): Promise<{ deleted: number; locked: { id: string; owner_id: string }[] }> {
  const projects: { id: string; owner_id: string }[] = await svc(`projects?select=id,owner_id&owner_id=${inList(ids)}`);
  const pids = projects.map((p) => p.id);
  const vault: { project_id: string }[] = pids.length ? await svc(`vault_log?select=project_id&project_id=${inList(pids)}`) : [];
  const lockedIds = new Set(vault.map((v) => v.project_id));
  const locked = projects.filter((p) => lockedIds.has(p.id));
  const free = pids.filter((p) => !lockedIds.has(p));
  const orP = (col: string) => (pids.length ? `,${col}.${inList(pids)}` : '');
  const del = (path: string) => svc(path, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });

  const matches: { id: string }[] = await svc(`matches?select=id&or=(user_id.${inList(ids)}${orP('project_id')})`);
  const mids = matches.map((m) => m.id);
  if (mids.length) {
    await del(`match_messages?match_id=${inList(mids)}`);
    await del(`matches?id=${inList(mids)}`);
  }
  await del(`swipes?or=(swiper_id.${inList(ids)},target_id.${inList(ids)}${orP('project_id')}${orP('target_id')})`);
  await del(`team_keys?or=(user_id.${inList(ids)}${orP('project_id')})`);
  await del(`team_members?or=(user_id.${inList(ids)}${orP('project_id')})`);
  await del(`copy_alerts?or=(owner_id.${inList(ids)},copier_id.${inList(ids)}${orP('original_project_id')})`);
  await del(`post_attempts?user_id=${inList(ids)}`);
  if (pids.length) await del(`idea_embeddings?project_id=${inList(pids)}`);
  if (locked.length) {
    await del(`project_roles?project_id=${inList(locked.map((p) => p.id))}`);
    await svc(`projects?id=${inList(locked.map((p) => p.id))}`, {
      method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ hidden: true }),
    });
  }
  if (free.length) await del(`projects?id=${inList(free)}`);
  return { deleted: free.length, locked };
}

// ---------- crypto copied from lib/crypto.ts, lib/teamKeys.ts, lib/vault.ts (no expo imports) ----------

const sha256 = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');
const vaultContent = (projectId: string, authorId: string, ideaHash: string, ts: string) =>
  `${projectId}|${authorId}|${ideaHash}|${new Date(ts).toISOString()}`;
const hashIdea = (ts: string, idea: string) => sha256(`${new Date(ts).toISOString()}::${idea}`);
const signContent = (content: string, signSec: Uint8Array) => encodeBase64(nacl.sign.detached(decodeUTF8(content), signSec));
const verifyContent = (content: string, sig: string, pub: string) => {
  try { return nacl.sign.detached.verify(decodeUTF8(content), decodeBase64(sig), decodeBase64(pub)); } catch { return false; }
};
const newTeamKey = () => encodeBase64(nacl.randomBytes(nacl.secretbox.keyLength));
function encryptForTeam(text: string, key: string) {
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  return { ciphertext: encodeBase64(nacl.secretbox(decodeUTF8(text), nonce, decodeBase64(key))), nonce: encodeBase64(nonce) };
}
function decryptForTeam(ciphertext: string, nonce: string, key: string) {
  const v = nacl.secretbox.open(decodeBase64(ciphertext), decodeBase64(nonce), decodeBase64(key));
  if (!v) throw new Error('Decryption failed');
  return encodeUTF8(v);
}
function wrapTeamKeyFor(me: Qa, publicKey: string, key: string) {
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  return { encrypted_team_key: encodeBase64(nacl.box(decodeBase64(key), nonce, decodeBase64(publicKey), me.boxSec)), nonce: encodeBase64(nonce) };
}
function unwrapTeamKey(me: Qa, encrypted: string, nonce: string, sender: string) {
  const v = nacl.box.open(decodeBase64(encrypted), decodeBase64(nonce), decodeBase64(sender), me.boxSec);
  if (!v || v.length !== nacl.secretbox.keyLength) throw new Error('Could not unwrap team key');
  return encodeBase64(v);
}

async function profileKeys(c: SupabaseClient, userId: string) {
  const { data, error } = await c.from('profiles').select('box_public_key,sign_public_key').eq('id', userId).single();
  fail(error, 'profile keys');
  if (!data!.box_public_key) throw new Error('member has not registered device keys');
  return data as { box_public_key: string; sign_public_key: string };
}

/** lib/teamKeys.ts storeOwnTeamKey */
async function storeOwnTeamKey(me: Qa, projectId: string, key: string) {
  const remote = await profileKeys(me.client, me.id);
  must(remote.box_public_key === me.boxPub && remote.sign_public_key === me.signPub, 'device keys differ');
  const { data: existing, error: re } = await me.client.from('team_keys').select('project_id').eq('project_id', projectId).eq('user_id', me.id).maybeSingle();
  fail(re, 'read team key');
  must(!existing, 'A team key already exists');
  const { error } = await me.client.from('team_keys').insert({
    project_id: projectId, user_id: me.id, sender_public_key: me.boxPub, ...wrapTeamKeyFor(me, me.boxPub, key),
  });
  fail(error, 'store own team key');
}

/** lib/teamKeys.ts ownKey */
async function ownKey(me: Qa, projectId: string) {
  const { data, error } = await me.client.from('team_keys').select('encrypted_team_key,nonce,sender_public_key').eq('project_id', projectId).eq('user_id', me.id).maybeSingle();
  fail(error, 'read team key');
  if (!data) throw new Error('Waiting for the project owner to share this team key');
  const { data: project, error: pe } = await me.client.from('projects').select('owner_id').eq('id', projectId).single();
  fail(pe, 'read project owner');
  if ((await profileKeys(me.client, project!.owner_id)).box_public_key !== data.sender_public_key) throw new Error('Team key sender does not match the owner');
  return unwrapTeamKey(me, data.encrypted_team_key, data.nonce, data.sender_public_key);
}

/** lib/teamKeys.ts shareTeamKey */
async function shareTeamKey(me: Qa, projectId: string, memberId: string) {
  const { data: project, error: pe } = await me.client.from('projects').select('owner_id').eq('id', projectId).single();
  fail(pe, 'read project');
  must(project!.owner_id === me.id, 'Only the owner can share a team key');
  const { data: members, error: me2 } = await me.client.from('team_members').select('user_id').eq('project_id', projectId).eq('user_id', memberId).eq('status', 'active');
  fail(me2, 'read team members');
  must(members?.length, 'Both people must commit before a key can be shared');
  const key = await ownKey(me, projectId);
  const { error } = await me.client.from('team_keys').insert({
    project_id: projectId, user_id: memberId, sender_public_key: me.boxPub,
    ...wrapTeamKeyFor(me, (await profileKeys(me.client, memberId)).box_public_key, key),
  });
  if (error && error.code !== '23505') fail(error, 'share team key');
}

let ideaVia = '';
/** lib/teamKeys.ts ideaRow + readIdea */
async function readIdea(me: Qa, projectId: string): Promise<string> {
  let row: { idea_public: string | null; idea_cipher: string | null; idea_nonce: string | null } | null;
  const rpc = await me.client.rpc('project_idea', { p: projectId });
  if (!rpc.error) {
    ideaVia = 'rpc project_idea';
    row = ((rpc.data ?? []) as typeof row[])[0] ?? null;
  } else {
    if (rpc.error.code !== 'PGRST202') fail(rpc.error, 'rpc project_idea');
    ideaVia = 'projects table (project_idea not deployed)';
    const { data, error } = await me.client.from('projects').select('visibility,idea_public,idea_cipher,idea_nonce').eq('id', projectId).maybeSingle();
    fail(error, 'read idea');
    row = data ? { idea_public: data.visibility === 'public' ? data.idea_public ?? '' : null, idea_cipher: data.idea_cipher, idea_nonce: data.idea_nonce } : null;
  }
  if (!row) throw new Error('This idea is not available');
  if (row.idea_public !== null && !row.idea_cipher) return row.idea_public;
  if (!row.idea_cipher || !row.idea_nonce) throw new Error('No encrypted idea is available');
  return decryptForTeam(row.idea_cipher, row.idea_nonce, await ownKey(me, projectId));
}

// ---------- api.real.ts equivalents ----------

async function getMatches(me: Qa) {
  const { data, error } = await me.client
    .from('matches')
    .select('id, project_id, user_id, role, owner_committed, user_committed, created_at, project:projects(owner_id, type, title)')
    .order('created_at', { ascending: false });
  fail(error, 'matches');
  const rows = (data ?? []) as any[];
  const otherIds = [...new Set(rows.map((r) => (r.user_id === me.id ? r.project?.owner_id : r.user_id)).filter(Boolean))];
  const people = new Map<string, string>();
  if (otherIds.length) {
    const { data: ps, error: e } = await me.client.from('profiles').select('id, username, name').in('id', otherIds);
    fail(e, 'match profiles');
    for (const p of ps ?? []) people.set(p.id, p.username ?? p.name);
  }
  return rows.map((r) => {
    const iAmUser = r.user_id === me.id;
    return {
      id: r.id as string, projectId: r.project_id as string, role: r.role as string,
      otherUsername: people.get(iAmUser ? r.project?.owner_id : r.user_id) ?? 'someone',
      iCommitted: iAmUser ? r.user_committed : r.owner_committed,
      theyCommitted: iAmUser ? r.owner_committed : r.user_committed,
      createdAt: r.created_at as string,
    };
  });
}

async function rpc<T = any>(me: Qa, fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await me.client.rpc(fn, args);
  fail(error, `rpc ${fn}`);
  return data as T;
}

async function getInterested(me: Qa) {
  return (await rpc<{ swipeRef: string; role: string; level: string; isSuper: boolean }[]>(me, 'get_interested')) ?? [];
}

async function hackShell(me: Qa): Promise<string> {
  const { data, error } = await me.client.from('projects').select('id')
    .eq('owner_id', me.id).eq('type', 'hackathon').eq('hidden', true).order('created_at').limit(1).maybeSingle();
  fail(error, 'hack shell');
  if (!data) throw new Error('no hack shell');
  return data.id;
}

// ---------- main ----------

async function main() {
  const runId = randomBytes(4).toString('hex');
  console.log(`signed-in e2e harness, run ${runId}, secrets in ${secretsDir}`);

  // Accounts and a clean starting state.
  const accounts = await ensureAccounts();
  const ids = accounts.map((a) => a.id);
  qaIds = ids;
  const pre = await cleanup(ids);
  const aliceId = accounts.find((a) => a.key === 'alice')!.id;
  let vaultProject = pre.locked.find((p) => p.owner_id === aliceId)?.id ?? null;

  const qa = {} as Record<QaKey, Qa>;
  const profiles: Record<QaKey, Record<string, unknown>> = {
    alice: { role: 'PM', level: 'advanced', occupation: 'working', skills: ['Product', 'Rust'], hours: 10 },
    bob: { role: 'Security', level: 'intermediate', occupation: 'student', skills: ['Supabase', 'Postgres'], hours: 10 },
    eve: { role: 'Hardware', level: 'beginner', occupation: 'student', skills: ['Arduino'], hours: 6 },
  };

  for (const a of accounts) {
    await check(`${a.key}: sign in (publishable key)`, async () => {
      const client = createClient(URL_, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
      const { data, error } = await client.auth.signInWithPassword({ email: a.email, password: a.password });
      fail(error, 'sign in');
      must(data.session?.user.id === a.id, 'wrong user');
      qa[a.key] = { ...a, username: a.email.split('@')[0], client } as Qa;
    });
  }
  must(qa.alice && qa.bob && qa.eve, 'sign in failed, cannot continue');
  const { alice, bob, eve } = qa;

  for (const me of [alice, bob, eve]) {
    const p = profiles[me.key];
    const row: Record<string, unknown> = {
      id: me.id, name: me.username, username: me.username, avatar_url: null, bio: 'QA harness account',
      primary_role: p.role, level: p.level, occupation: p.occupation, skills: p.skills,
      prompts: [{ q: 'Worst commit message', a: 'qa qa qa' }], hours_per_week: p.hours, timezone: 'America/New_York',
      women_only: false,
    };
    const { data: existed } = await me.client.from('profiles').select('id').eq('id', me.id).maybeSingle();
    // Exactly what lib/api.real.ts saveProfile sends.
    const upserted = await check(`${me.key}: saveProfile upsert as app (${existed ? 'existing' : 'new'} row)`, async () => {
      const { error } = await me.client.from('profiles').upsert(row, { onConflict: 'id' });
      fail(error, 'upsert');
    });
    if (!upserted) {
      // Fallback so the rest of the flow can run. If women_only is no longer client writable (W2 hardening),
      // drop it; if upsert itself is refused, insert when missing, otherwise update without id.
      await check(`${me.key}: profile write fallback`, async () => {
        const noWomen = { ...row };
        delete noWomen.women_only;
        const { error: e1 } = await me.client.from('profiles').upsert(noWomen, { onConflict: 'id' });
        if (!e1) return 'upsert without women_only works';
        const { id: _id, ...cols } = noWomen;
        const { error: e2 } = existed
          ? await me.client.from('profiles').update(cols).eq('id', me.id)
          : await me.client.from('profiles').insert(noWomen);
        fail(e2, existed ? 'update' : 'insert');
        return `upsert refused (${e1.code}), ${existed ? 'update' : 'insert'} without women_only works`;
      });
    }

    await check(`${me.key}: registerDeviceKeys (only when null)`, async () => {
      const { data: prof, error } = await me.client.from('profiles').select('box_public_key,sign_public_key').eq('id', me.id).single();
      fail(error, 'read keys');
      let secrets = keyStore[me.id];
      if (!secrets) {
        must(!prof!.box_public_key && !prof!.sign_public_key, 'keys already registered but secret missing');
        secrets = { box: encodeBase64(nacl.box.keyPair().secretKey), sign: encodeBase64(nacl.sign.keyPair().secretKey) };
        keyStore[me.id] = secrets;
        saveKeys(); // persist the secret before the public half is registered
      }
      me.boxSec = decodeBase64(secrets.box);
      me.signSec = decodeBase64(secrets.sign);
      me.boxPub = encodeBase64(nacl.box.keyPair.fromSecretKey(me.boxSec).publicKey);
      me.signPub = encodeBase64(nacl.sign.keyPair.fromSecretKey(me.signSec).publicKey);
      if (prof!.box_public_key || prof!.sign_public_key) {
        must(prof!.box_public_key === me.boxPub && prof!.sign_public_key === me.signPub, 'registered keys do not match local secret');
        return 'already registered, reused';
      }
      const { data, error: ue } = await me.client.from('profiles')
        .update({ box_public_key: me.boxPub, sign_public_key: me.signPub })
        .eq('id', me.id).is('box_public_key', null).is('sign_public_key', null).select('id');
      fail(ue, 'register keys');
      must(data?.length === 1, 'keys not written');
      return 'registered new keys';
    });
  }

  gate((s) => / registerDeviceKeys /.test(s) || / profile write fallback/.test(s));

  await check('alice: F11 registered keys cannot be replaced', async () => {
    const other = encodeBase64(nacl.box.keyPair().publicKey);
    const { error } = await alice.client.from('profiles').update({ box_public_key: other }).eq('id', alice.id);
    must(error, 'key replacement was accepted');
    return 'rejected';
  });

  await check('alice: F1 reliability_score not client writable', async () => {
    const { error } = await alice.client.from('profiles').update({ reliability_score: 100 }).eq('id', alice.id);
    must(error, 'reliability_score update was accepted');
    return 'rejected';
  });

  // ----- postIdea (private, encrypted with a team key) -----
  const idea = `QA harness idea ${runId}: a sealed calibration log for lab sensors, nonce ${randomBytes(6).toString('hex')}`;
  const ideaTs = new Date().toISOString();
  const ideaHash = hashIdea(ideaTs, idea);
  let projectId = '';
  let teamKey = '';
  await check('alice: postIdea private via post_idea v2', async () => {
    teamKey = newTeamKey();
    const sealed = encryptForTeam(idea, teamKey);
    const { data, error } = await alice.client.functions.invoke('post_idea', {
      body: {
        title: `QA private ${runId}`, shortPitch: 'QA harness project, safe to ignore', type: 'original',
        theme: 'Security', timeframe: 'weekend', githubUrl: null, visibility: 'private', womenOnly: false,
        roles: [{ role: 'Security', open: 1 }], ideaCipher: sealed.ciphertext, ideaNonce: sealed.nonce,
        ideaPublic: null, fullIdea: idea,
      },
    });
    if (error) {
      const body = await (error as any).context?.text?.().catch(() => '');
      throw new Error(`post_idea: ${error.message} ${body ?? ''}`);
    }
    projectId = (data as { projectId?: string })?.projectId ?? '';
    must(projectId, `no projectId: ${JSON.stringify(data)}`);
    return `status ${(data as any).status}`;
  });

  await check('alice: stored project has no plaintext idea', async () => {
    const [row] = await svc(`projects?select=idea_public,idea_cipher,idea_nonce,visibility&id=eq.${projectId}`);
    must(row, 'project missing');
    must(row.visibility === 'private' && row.idea_public === null, 'idea_public set on a private idea');
    must(row.idea_cipher && !String(row.idea_cipher).includes('calibration'), 'cipher missing or plaintext');
  });

  await check('alice: storeOwnTeamKey', async () => {
    must(projectId, 'no project');
    await storeOwnTeamKey(alice, projectId, teamKey);
    must((await ownKey(alice, projectId)) === teamKey, 'own key round trip failed');
  });

  gate((s) => s.startsWith('alice: postIdea') || s.startsWith('alice: storeOwnTeamKey'));

  // ----- deck, swipes, match -----
  await check('bob: get_deck(normal) shows alice project', async () => {
    const cards = await rpc<any[]>(bob, 'get_deck', { p_mode: 'normal' });
    const card = cards.find((c) => c.kind === 'project' && c.id === projectId);
    must(card, `project not in deck (${cards.length} cards)`);
    must(card.fullIdea == null, 'private idea leaked in card');
    must(card.ownerBoxPublicKey === alice.boxPub, 'owner box key on card does not match');
    return `${cards.length} cards`;
  });

  await check('bob: record_swipe right on project', async () => {
    const r = await rpc(bob, 'record_swipe', { p_target_id: projectId, p_target_type: 'project', p_project_id: projectId, p_role: 'Security', p_direction: 'right' });
    must(r.matched === false, 'matched too early');
  });

  await check('alice: get_deck(normal) shows bob for her project', async () => {
    const cards = await rpc<any[]>(alice, 'get_deck', { p_mode: 'normal' });
    const card = cards.find((c) => c.kind === 'person' && c.id === bob.id);
    must(card, `bob not in deck (${cards.length} cards)`);
    must(card.forProjectId === projectId, 'forProjectId is not her project');
    must(card.boxPublicKey === bob.boxPub, 'bob box key on card does not match');
    return `${cards.length} cards`;
  });

  let matchId = '';
  await check('alice: record_swipe right on bob forms match', async () => {
    const r = await rpc(alice, 'record_swipe', { p_target_id: bob.id, p_target_type: 'person', p_project_id: projectId, p_role: null, p_direction: 'right' });
    must(r.matched === true && r.matchId, `no match: ${JSON.stringify(r)}`);
    matchId = r.matchId;
  });

  await check('getMatches returns the match for alice and bob', async () => {
    const a = (await getMatches(alice)).find((m) => m.id === matchId);
    const b = (await getMatches(bob)).find((m) => m.id === matchId);
    must(a && b, 'match missing for one side');
    must(a.otherUsername === bob.username && b.otherUsername === alice.username, 'wrong other username');
    must(a.role === 'Security', `role ${a.role}`);
  });

  await check('eve: cannot see the alice-bob match', async () => {
    const { data, error } = await eve.client.from('matches').select('id').eq('id', matchId);
    must(error || !data?.length, 'eve can read the match');
  });

  // ----- commit, team, team key, idea -----
  await check('commit_to_project both sides, team_members has both', async () => {
    const r1 = await rpc(alice, 'commit_to_project', { p_match_id: matchId });
    must(r1.both === false, 'both true after one side');
    const r2 = await rpc(bob, 'commit_to_project', { p_match_id: matchId });
    must(r2.both === true, 'both not true');
    const { data, error } = await alice.client.from('team_members').select('user_id, ownership').eq('project_id', projectId).eq('status', 'active');
    fail(error, 'team_members');
    const users = new Map((data ?? []).map((m) => [m.user_id, m.ownership]));
    must(users.get(alice.id) === 'owner' && users.get(bob.id) === 'collaborator', `members ${JSON.stringify(data)}`);
  });

  await check('alice: shareTeamKey with bob', async () => {
    await shareTeamKey(alice, projectId, bob.id);
  });

  await check('bob: readIdea decrypts the private idea', async () => {
    const text = await readIdea(bob, projectId);
    must(text === idea, 'decrypted text differs');
    return `via ${ideaVia}`;
  });

  await check('eve: has no team key, cannot read idea', async () => {
    const { data } = await eve.client.from('team_keys').select('project_id').eq('project_id', projectId);
    must(!data?.length, 'eve can see a team key');
    let read = false;
    try { read = (await readIdea(eve, projectId)) === idea; } catch { /* expected */ }
    must(!read, 'eve decrypted the idea');
  });

  // ----- encrypted chat and Realtime -----
  const chatText = `qa secret plan ${runId}`;
  let messageId = '';
  let realtimeMs = -1;
  await check('chat: alice seals, bob receives via Realtime < 5s', async () => {
    const { data: s } = await bob.client.auth.getSession();
    await bob.client.realtime.setAuth(s.session!.access_token);
    let resolveRow: (row: any) => void = () => {};
    const got = new Promise<any>((r) => { resolveRow = r; });
    const channel = bob.client
      .channel(`qa-messages-${runId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'match_messages', filter: `match_id=eq.${matchId}` }, (p) => resolveRow(p.new));
    await new Promise<void>((res, rej) => {
      const t = setTimeout(() => rej(new Error('subscribe timeout')), 10000);
      channel.subscribe((status, err) => {
        if (status === 'SUBSCRIBED') { clearTimeout(t); res(); }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') { clearTimeout(t); rej(new Error(`realtime ${status} ${err?.message ?? ''}`)); }
      });
    });
    await new Promise((r) => setTimeout(r, 750));
    const body = seal(chatText, matchId, alice.boxPub, bob.boxPub, alice.boxSec);
    const start = Date.now();
    const { data, error } = await alice.client.from('match_messages').insert({ match_id: matchId, sender_id: alice.id, body }).select('id').single();
    fail(error, 'insert message');
    messageId = data!.id;
    const row = await Promise.race([got, new Promise((_, rej) => setTimeout(() => rej(new Error('no Realtime event in 5s')), 5000))]) as any;
    realtimeMs = Date.now() - start;
    await bob.client.removeChannel(channel);
    must(row.id === messageId, 'wrong row');
    must(open(row.body, matchId, alice.boxPub, alice.boxPub, bob.boxSec) === chatText, 'realtime body did not open');
    return `${realtimeMs} ms`;
  });

  await check('chat: bob reads the row and open() returns the text', async () => {
    const { data, error } = await bob.client.from('match_messages').select('id, sender_id, body').eq('match_id', matchId);
    fail(error, 'read messages');
    const row = (data ?? []).find((m) => m.id === messageId);
    must(row, 'message not visible to bob');
    must(open(row.body, matchId, alice.boxPub, alice.boxPub, bob.boxSec) === chatText, 'open failed');
    must(!row.body.includes(chatText) && !row.body.includes('secret plan'), 'plaintext in stored body');
    must(row.body.startsWith('e2e1.'), 'not e2e1 format');
  });

  await check('chat: stored body (service view) has no plaintext', async () => {
    const [row] = await svc(`match_messages?select=body&id=eq.${messageId}`);
    must(row && !row.body.includes(chatText), 'plaintext stored');
  });

  await check('chat: eve cannot read the message', async () => {
    const { data, error } = await eve.client.from('match_messages').select('id').eq('match_id', matchId);
    must(error || !data?.length, `eve read ${data?.length} rows`);
    return error ? `error ${error.code}` : '0 rows';
  });

  await check('chat: eve cannot insert into their match', async () => {
    const body = seal('eve was here', matchId, eve.boxPub, bob.boxPub, eve.boxSec);
    const { error } = await eve.client.from('match_messages').insert({ match_id: matchId, sender_id: eve.id, body });
    must(error, 'eve insert was accepted');
    const { error: e2 } = await eve.client.from('match_messages').insert({ match_id: matchId, sender_id: alice.id, body });
    must(e2, 'eve spoofed insert was accepted');
    return `rejected (${error.code})`;
  });

  await check('chat: body sealed for another match fails open()', async () => {
    const otherMatch = crypto.randomUUID();
    const body = seal('replayed', otherMatch, alice.boxPub, bob.boxPub, alice.boxSec);
    const { error } = await alice.client.from('match_messages').insert({ match_id: matchId, sender_id: alice.id, body });
    fail(error, 'insert replay');
    let opened = false;
    try { open(body, matchId, alice.boxPub, alice.boxPub, bob.boxSec); opened = true; } catch (e) { must(/another chat/.test((e as Error).message), (e as Error).message); }
    must(!opened, 'replayed body opened');
  });

  // ----- Who wants you: respondToInterested like and pass -----
  let eveShell = '';
  await check('eve: setHackRoles creates shell, swipes right on bob', async () => {
    await rpc(eve, 'ensure_hack_team', { p_roles: [{ role: 'Security', open: 1 }] });
    eveShell = await hackShell(eve);
    const r = await rpc(eve, 'record_swipe', { p_target_id: bob.id, p_target_type: 'person', p_project_id: eveShell, p_role: 'Hardware', p_direction: 'right' });
    must(r.matched === false, 'matched early');
  });

  let eveBobMatch = '';
  await check('bob: respondToInterested like -> match', async () => {
    const card = (await getInterested(bob)).find((c) => c.role === 'Hardware');
    must(card, 'eve card not in get_interested');
    must(!('username' in card) && !('id' in card), 'card leaks identity');
    const r = await rpc(bob, 'respond_interested', { p_swipe_ref: card.swipeRef, p_like: true });
    must(r.matched === true && r.matchId, `no match ${JSON.stringify(r)}`);
    eveBobMatch = r.matchId;
    const m = (await getMatches(bob)).find((x) => x.id === eveBobMatch);
    must(m?.otherUsername === eve.username, 'match does not show eve');
    must(!(await getInterested(bob)).some((c) => c.swipeRef === card.swipeRef), 'card still listed');
  });

  await check('bob: respondToInterested pass -> no match', async () => {
    await rpc(alice, 'ensure_hack_team', { p_roles: null });
    const aliceShell = await hackShell(alice);
    await rpc(alice, 'record_swipe', { p_target_id: bob.id, p_target_type: 'person', p_project_id: aliceShell, p_role: 'Mobile', p_direction: 'right' });
    const card = (await getInterested(bob)).find((c) => c.role === 'Mobile');
    must(card, 'alice card not in get_interested');
    const r = await rpc(bob, 'respond_interested', { p_swipe_ref: card.swipeRef, p_like: false });
    must(r.matched === false, 'pass created a match');
    must(!(await getInterested(bob)).some((c) => c.swipeRef === card.swipeRef), 'card still listed');
  });

  await check('eve: cannot respond to bob card (not your card)', async () => {
    const { data } = await svc(`swipes?select=id&swiper_id=eq.${alice.id}&target_id=eq.${bob.id}&direction=eq.right`).then((d) => ({ data: d }));
    must(data?.[0]?.id, 'no swipe to test with');
    const { error } = await eve.client.rpc('respond_interested', { p_swipe_ref: data[0].id, p_like: true });
    must(error, 'eve answered a card that is not hers');
  });

  // ----- hack roles -----
  await check('bob: setHackRoles then getHackRoles round trip', async () => {
    const want = [{ role: 'Frontend', open: 2 }, { role: 'Design', open: 1 }];
    await rpc(bob, 'ensure_hack_team', { p_roles: want });
    const team = await hackShell(bob);
    const { data, error } = await bob.client.from('project_roles').select('role, slots_open').eq('project_id', team);
    fail(error, 'project_roles');
    const got = (data ?? []).filter((r) => r.slots_open > 0).map((r) => `${r.role}:${r.slots_open}`).sort().join(',');
    must(got === 'Design:1,Frontend:2', `got ${got}`);
    return got;
  });

  // ----- super commits and undo -----
  await check('eve: super_commits_left, super swipe, undo_last_swipe', async () => {
    const before = await rpc<number>(eve, 'super_commits_left');
    must(before === 1, `expected 1 super left, got ${before}`);
    await rpc(eve, 'record_swipe', { p_target_id: projectId, p_target_type: 'project', p_project_id: projectId, p_role: 'Hardware', p_direction: 'super' });
    must((await rpc<number>(eve, 'super_commits_left')) === 0, 'super not counted');
    const superCard = (await getInterested(alice)).find((c) => c.isSuper);
    must(superCard, 'alice does not see the super card');
    await rpc(eve, 'undo_last_swipe');
    must((await rpc<number>(eve, 'super_commits_left')) === 1, 'undo did not restore super');
    must(!(await getInterested(alice)).some((c) => c.swipeRef === superCard.swipeRef), 'undone swipe still listed');
    return 'left 1 -> 0 -> 1';
  });

  await check('bob: undo_last_swipe refuses after a match', async () => {
    // Bob's latest swipe is the pass on alice's shell (no match), so this undo must succeed.
    // His next latest is the like back on eve's shell, which made a match, so the second undo must be refused.
    await rpc(bob, 'undo_last_swipe');
    const { data: list } = await bob.client.from('swipes').select('id, target_id').eq('swiper_id', bob.id).order('created_at', { ascending: false });
    must(list?.[0]?.target_id === eveShell, `latest swipe is not the eve shell like (${list?.length} swipes)`);
    const { error } = await bob.client.rpc('undo_last_swipe');
    must(error && /already matched/.test(error.message), `undo after match was allowed: ${error?.message}`);
    return 'pass undone, matched swipe refused';
  });

  // ----- vault -----
  let entry: any = null;
  const vaultTarget = vaultProject ?? projectId;
  await check('alice: appendVault (append_vault_entry, signed)', async () => {
    const content = vaultContent(vaultTarget, alice.id, ideaHash, ideaTs);
    const { data, error } = await alice.client.rpc('append_vault_entry', {
      p_project: vaultTarget, p_idea_hash: ideaHash, p_ts: ideaTs, p_sig: signContent(content, alice.signSec),
    });
    fail(error, 'append_vault_entry');
    entry = data;
    must(entry?.entry_hash, 'no entry');
    must(sha256(`${content}|${entry.prev_hash}`) === entry.entry_hash, 'entry_hash does not recompute');
    must(verifyContent(content, entry.author_sig, alice.signPub), 'signature invalid');
    return `seq ${entry.seq}, ${vaultProject ? 'reused vault project' : 'new project'}`;
  });
  if (!vaultProject) vaultProject = projectId;

  await check('eve: cannot append to alice vault project', async () => {
    const content = vaultContent(vaultTarget, eve.id, ideaHash, ideaTs);
    const { error } = await eve.client.rpc('append_vault_entry', { p_project: vaultTarget, p_idea_hash: ideaHash, p_ts: ideaTs, p_sig: signContent(content, eve.signSec) });
    must(error, 'eve appended');
  });

  await check('vault: full chain verifies (verifyVaultSnapshot logic)', async () => {
    const rows: any[] = [];
    for (let off = 0; ; off += 500) {
      const { data, error } = await alice.client.from('vault_log').select('*').order('seq').range(off, off + 499);
      fail(error, 'vault_log');
      rows.push(...(data ?? []));
      if (!data || data.length < 500) break;
    }
    const keys: Record<string, string> = {};
    for (const k of (await rpc<any[]>(alice, 'vault_signing_keys')) ?? []) if (k.sign_public_key) keys[k.author_id] = k.sign_public_key;
    let prev = '0'.repeat(64);
    let prevSeq = 0;
    for (const r of rows) {
      const content = vaultContent(r.project_id, r.author_id, r.idea_hash, r.ts);
      if (r.seq <= prevSeq || r.prev_hash !== prev) throw new Error(`chain broken at seq ${r.seq}`);
      if (sha256(`${content}|${prev}`) !== r.entry_hash) throw new Error(`entry edited at seq ${r.seq}`);
      if (!keys[r.author_id] || !verifyContent(content, r.author_sig, keys[r.author_id])) throw new Error(`signature invalid at seq ${r.seq}`);
      prev = r.entry_hash;
      prevSeq = r.seq;
    }
    must(rows.some((r) => r.seq === entry?.seq), 'new entry not in chain');
    return `${rows.length} entries ok (checkpoint not deployed, not checked)`;
  });

  // ----- activity, score, interested, my projects, copy alerts -----
  await check('alice: getActivity queries (match, team join, vault commit)', async () => {
    const matches = await getMatches(alice);
    const [{ data: alerts, error: e1 }, { data: owned, error: e2 }, { data: vault, error: e3 }] = await Promise.all([
      alice.client.from('copy_alerts').select('id, original_project_id, similarity, created_at, project:projects(title)').order('created_at', { ascending: false }),
      alice.client.from('projects').select('id, title').eq('owner_id', alice.id).neq('type', 'hackathon'),
      alice.client.from('vault_log').select('seq, project_id, ts').eq('author_id', alice.id).order('seq', { ascending: false }).limit(10),
    ]);
    fail(e1, 'alerts'); fail(e2, 'owned'); fail(e3, 'vault');
    await getInterested(alice);
    const { error: e4 } = await alice.client.from('matches').select('id, created_at').in('id', matches.map((m) => m.id));
    fail(e4, 'match times');
    const titles = (owned ?? []).map((p) => p.id);
    const { data: joins, error: e5 } = await alice.client.from('team_members').select('project_id, user_id, joined_at')
      .in('project_id', titles).neq('user_id', alice.id).eq('status', 'active');
    fail(e5, 'joins');
    must(matches.some((m) => m.id === matchId), 'no match event');
    must((joins ?? []).some((j) => j.user_id === bob.id && j.project_id === projectId), 'no team join event');
    must((vault ?? []).some((v) => v.seq === entry?.seq), 'no vault event');
    return `${matches.length} matches, ${alerts?.length ?? 0} alerts, ${joins?.length} joins, ${vault?.length} commits`;
  });

  for (const me of [alice, bob, eve]) {
    await check(`${me.key}: getScoreEvents sums to reliability_score`, async () => {
      const [{ data: p, error: e1 }, { data: rows, error: e2 }] = await Promise.all([
        me.client.from('profiles').select('reliability_score').eq('id', me.id).single(),
        me.client.from('reliability_events').select('label, delta, created_at').eq('user_id', me.id).order('created_at'),
      ]);
      fail(e1, 'profile'); fail(e2, 'reliability_events');
      const sum = 70 + (rows ?? []).reduce((a, r) => a + r.delta, 0);
      must(sum === (p!.reliability_score ?? 70), `70 + deltas = ${sum}, score = ${p!.reliability_score}`);
      return `score ${p!.reliability_score}, ${rows?.length ?? 0} events`;
    });
  }

  await check('alice: get_interested returns blurred cards only', async () => {
    const cards = await getInterested(alice);
    for (const c of cards) must(Object.keys(c).sort().join(',') === 'isSuper,level,role,swipeRef', `extra keys ${Object.keys(c)}`);
    return `${cards.length} cards`;
  });

  await check('bob: getMyProjects queries include joined project', async () => {
    const [{ data: memberOf, error: e1 }, { data: owned, error: e2 }] = await Promise.all([
      bob.client.from('team_members').select('project_id').eq('user_id', bob.id).eq('status', 'active'),
      bob.client.from('projects').select('id').eq('owner_id', bob.id),
    ]);
    fail(e1, 'memberOf'); fail(e2, 'owned');
    const pids = [...new Set([...(owned ?? []).map((p) => p.id), ...(memberOf ?? []).map((m) => m.project_id)])];
    const { data: rows, error: e3 } = await bob.client.from('projects')
      .select('id, owner_id, title, short_pitch, type, visibility, idea_public, hidden, created_at').in('id', pids);
    fail(e3, 'projects');
    const visible = (rows ?? []).filter((r) => !r.hidden && r.type !== 'hackathon');
    const mine = visible.find((r) => r.id === projectId);
    must(mine && mine.owner_id === alice.id, 'joined project missing');
    const { error: e4 } = await bob.client.from('team_members').select('project_id, user_id, role').in('project_id', visible.map((r) => r.id)).eq('status', 'active');
    fail(e4, 'members');
    const counts = await rpc<any[]>(bob, 'project_role_counts', { p: projectId });
    const hash = await rpc<string>(bob, 'project_commit_hash', { p: projectId });
    must(Array.isArray(counts) && counts.some((c) => c.role === 'Security' && c.filled === 1), `role counts ${JSON.stringify(counts)}`);
    must(/^[0-9a-f]{7}$/.test(hash), `hash ${hash}`);
    return `${visible.length} visible projects`;
  });

  await check('alice: getMyProjects includes her project as mine', async () => {
    const { data, error } = await alice.client.from('projects').select('id, owner_id, hidden, type').eq('owner_id', alice.id);
    fail(error, 'owned');
    must((data ?? []).some((r) => r.id === projectId && !r.hidden), 'own project missing');
  });

  await check('copy alerts: read own, copier_id column not readable', async () => {
    const { error } = await alice.client.from('copy_alerts')
      .select('id, original_project_id, similarity, created_at, project:projects(title)').order('created_at', { ascending: false });
    fail(error, 'copy_alerts read');
    const { error: e2 } = await eve.client.from('copy_alerts').select('copier_id');
    must(e2, 'copier_id readable by client');
  });

  // ----- cleanup -----
  await check('cleanup: remove QA data (service key, QA ids only)', async () => {
    for (const me of [alice, bob, eve]) await me.client.auth.signOut().catch(() => {});
    const post = await cleanup(ids);
    cleanedUp = true;
    const left = await svc(`projects?select=id&owner_id=${inList(ids)}&hidden=is.false`);
    must(!left.length, `${left.length} visible QA projects left`);
    const swipesLeft = await svc(`swipes?select=id&swiper_id=${inList(ids)}`);
    must(!swipesLeft.length, 'swipes left');
    return `deleted ${post.deleted} projects, kept ${post.locked.length} hidden vault project(s) (F3)`;
  });
}

function printTable() {
  const w = Math.max(...results.map((r) => r.step.length), 4);
  const lines = [`| ${'Step'.padEnd(w)} | Result | Detail`, `|${'-'.repeat(w + 2)}|--------|--------`];
  for (const r of results) lines.push(`| ${r.step.padEnd(w)} | ${r.ok ? 'PASS  ' : 'FAIL  '} | ${r.detail}`);
  const failed = results.filter((r) => !r.ok).length;
  console.log('\n' + lines.join('\n'));
  console.log(`\n${results.length - failed}/${results.length} passed${failed ? `, ${failed} FAILED` : ''}`);
  for (const n of notes) console.log(`note: ${n}`);
  return failed;
}

let qaIds: string[] = [];
let cleanedUp = false;

main()
  .catch(async (e) => {
    results.push({ step: 'harness aborted', ok: false, detail: (e as Error).message.slice(0, 200) });
    if (qaIds.length && !cleanedUp) {
      await check('cleanup after abort (QA ids only)', async () => {
        const post = await cleanup(qaIds);
        return `deleted ${post.deleted} projects, kept ${post.locked.length} hidden vault project(s) (F3)`;
      });
    }
  })
  .finally(() => {
    const failed = printTable();
    process.exit(failed ? 1 : 0);
  });
