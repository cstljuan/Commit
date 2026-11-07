// Seed and reset demo data in one command.
//   npx tsx scripts/seed/seed.mts             reset, then seed clean demo state
//   npx tsx scripts/seed/seed.mts --reset     reset only
// Reads scripts/.env (never committed): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
// DEMO_ALICE_EMAIL/PASSWORD, DEMO_BOB_EMAIL/PASSWORD. Adds SEED_USER_PASSWORD on first run.
//
// Reset touches only accounts on the demo domain:
//   synthetic users are deleted and recreated (fresh device keys each run, so F11 never blocks a reseed),
//   Alice and Bob keep their accounts and phone keys; only their projects, swipes and alerts are removed.
// Projects with vault entries cannot be deleted (F3). The script reports them instead of failing.

import { randomBytes } from 'node:crypto';
import { readFileSync, appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import nacl from 'tweetnacl';
import naclUtil from 'tweetnacl-util';

import { DEMO_DOMAIN, projects, users, type SeedUser } from './data.mts';

const { encodeBase64, decodeUTF8 } = naclUtil;
const here = dirname(fileURLToPath(import.meta.url));
const envPath = join(here, '..', '.env');

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

const env = loadEnv();
if (!env.SEED_USER_PASSWORD) {
  env.SEED_USER_PASSWORD = randomBytes(12).toString('base64url');
  appendFileSync(envPath, `SEED_USER_PASSWORD=${env.SEED_USER_PASSWORD}\n`);
}
const URL = env.SUPABASE_URL;
const SECRET = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !SECRET) throw new Error('scripts/.env needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');

const H = { apikey: SECRET, 'Content-Type': 'application/json' };

async function api(path: string, init: RequestInit = {}): Promise<any> {
  const res = await fetch(URL + path, { ...init, headers: { ...H, ...(init.headers as any) } });
  const text = await res.text();
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path.split('?')[0]} ${res.status}: ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}
const rest = (path: string, init: RequestInit = {}) =>
  api('/rest/v1/' + path, { ...init, headers: { Prefer: 'return=representation', ...(init.headers as any) } });
const inList = (ids: string[]) => `in.(${ids.join(',')})`;

const emailFor = (u: SeedUser) =>
  u.key === 'alice' ? env.DEMO_ALICE_EMAIL : u.key === 'bob' ? env.DEMO_BOB_EMAIL : `${u.key}@${DEMO_DOMAIN}`;
const passwordFor = (u: SeedUser) =>
  u.key === 'alice' ? env.DEMO_ALICE_PASSWORD : u.key === 'bob' ? env.DEMO_BOB_PASSWORD : env.SEED_USER_PASSWORD;

async function demoAuthUsers(): Promise<{ id: string; email: string }[]> {
  const out: { id: string; email: string }[] = [];
  for (let page = 1; page < 20; page++) {
    const j = await api(`/auth/v1/admin/users?page=${page}&per_page=200`);
    const list = j.users ?? [];
    out.push(...list.filter((u: any) => String(u.email ?? '').endsWith('@' + DEMO_DOMAIN)));
    if (list.length < 200) break;
  }
  return out;
}

async function reset() {
  const all = await demoAuthUsers();
  const demoEmails = new Set([env.DEMO_ALICE_EMAIL, env.DEMO_BOB_EMAIL]);
  const keep = all.filter((u) => demoEmails.has(u.email));
  const synthetic = all.filter((u) => !demoEmails.has(u.email));
  const keepIds = keep.map((u) => u.id);

  // Vault rows block project deletion (F3). Report them and leave those projects in place.
  const allIds = all.map((u) => u.id);
  let locked: string[] = [];
  if (allIds.length) {
    const v = await rest(`vault_log?select=project_id&author_id=${inList(allIds)}`);
    locked = [...new Set<string>(v.map((r: any) => r.project_id))];
  }
  const notLocked = locked.length ? `&id=not.${inList(locked)}` : '';

  if (keepIds.length) {
    await rest(`copy_alerts?owner_id=${inList(keepIds)}`, { method: 'DELETE' });
    await rest(`post_attempts?user_id=${inList(keepIds)}`, { method: 'DELETE' });
    await rest(`swipes?swiper_id=${inList(keepIds)}`, { method: 'DELETE' });
    await rest(`matches?user_id=${inList(keepIds)}`, { method: 'DELETE' });
    await rest(`team_members?user_id=${inList(keepIds)}&ownership=neq.owner`, { method: 'DELETE' });
    await rest(`projects?owner_id=${inList(keepIds)}${notLocked}`, { method: 'DELETE' });
  }
  let deleted = 0;
  for (const u of synthetic) {
    try {
      await rest(`projects?owner_id=eq.${u.id}${notLocked}`, { method: 'DELETE' });
      await api(`/auth/v1/admin/users/${u.id}`, { method: 'DELETE' });
      deleted++;
    } catch (e) {
      console.log(`  could not delete ${u.email}: ${(e as Error).message}`);
    }
  }
  console.log(`reset: cleared Alice and Bob data, deleted ${deleted} synthetic users` +
    (locked.length ? `, kept ${locked.length} project(s) that have vault entries (F3)` : ''));
}

async function ensureUser(u: SeedUser, existing: Map<string, string>): Promise<string> {
  const email = emailFor(u);
  if (!email) throw new Error(`no email for ${u.key}`);
  const found = existing.get(email);
  if (found) return found;
  const j = await api('/auth/v1/admin/users', {
    method: 'POST',
    body: JSON.stringify({ email, password: passwordFor(u), email_confirm: true }),
  });
  return j.id;
}

type Keys = { boxPub: string; boxSec: Uint8Array };

/** Signs in as the user and posts through the deployed post_idea function. Returns the project id. */
async function postIdeaAs(u: SeedUser, body: Record<string, unknown>): Promise<string> {
  const pub = env.SUPABASE_PUBLISHABLE_KEY;
  if (!pub) throw new Error('scripts/.env needs SUPABASE_PUBLISHABLE_KEY');
  const tok = await fetch(URL + '/auth/v1/token?grant_type=password', {
    method: 'POST', headers: { apikey: pub, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: emailFor(u), password: passwordFor(u) }),
  }).then((r) => r.json());
  if (!tok.access_token) throw new Error(`could not sign in as ${u.key}`);
  const res = await fetch(URL + '/functions/v1/post_idea', {
    method: 'POST',
    headers: { apikey: pub, Authorization: `Bearer ${tok.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.projectId) throw new Error(`post_idea as ${u.key} failed: ${res.status} ${JSON.stringify(j)}`);
  return j.projectId;
}

async function seed() {
  const existing = new Map((await demoAuthUsers()).map((u) => [u.email, u.id]));
  const ids = new Map<string, string>();
  const keys = new Map<string, Keys>();

  // Profiles. Synthetic users get fresh device keys (F13). Alice and Bob register keys on their phones.
  const current = new Map<string, any>();
  for (const u of users) ids.set(u.key, await ensureUser(u, existing));
  const prof = await rest(`profiles?select=id,box_public_key,sign_public_key&id=${inList([...ids.values()])}`);
  for (const p of prof) current.set(p.id, p);

  for (const u of users) {
    const id = ids.get(u.key)!;
    const row: Record<string, unknown> = {
      id, name: u.name, username: u.username, primary_role: u.role, level: u.level, occupation: u.occupation,
      skills: u.skills, prompts: u.prompts, hours_per_week: u.hours, reliability_score: u.reliability,
      women_only: !!u.womenOnly, bio: null, avatar_url: null, timezone: 'America/New_York',
    };
    if (!u.demo && !current.get(id)?.box_public_key) {
      const box = nacl.box.keyPair();
      const sign = nacl.sign.keyPair();
      row.box_public_key = encodeBase64(box.publicKey);
      row.sign_public_key = encodeBase64(sign.publicKey);
      keys.set(u.key, { boxPub: row.box_public_key as string, boxSec: box.secretKey });
    }
    await rest('profiles?on_conflict=id', {
      method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(row),
    });
  }
  console.log(`seed: ${users.length} profiles`);

  // Projects go through the deployed post_idea function, signed in as each owner (F13), so every seeded
  // idea gets an embedding and copy detection works on it. Public ideas are readable on the card.
  // Private ideas are encrypted here with a team key wrapped for the owner's own box key (lib/teamKeys.ts format).
  const projectIds = new Map<string, string>();
  for (const p of projects) {
    const owner = ids.get(p.owner)!;
    const ownerUser = users.find((u) => u.key === p.owner)!;
    const body: Record<string, unknown> = {
      title: p.title, shortPitch: p.teaser, type: 'original', theme: p.theme, timeframe: p.timeframe,
      githubUrl: p.githubUrl ?? null, visibility: p.visibility, womenOnly: !!p.womenOnly,
      roles: p.roles, fullIdea: p.idea,
    };
    let wrapped: Record<string, string> | null = null;
    if (p.visibility === 'private') {
      const k = keys.get(p.owner);
      if (!k) throw new Error(`private project ${p.key} needs an owner with script-held keys`);
      const teamKey = nacl.randomBytes(nacl.secretbox.keyLength);
      const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
      body.ideaCipher = encodeBase64(nacl.secretbox(decodeUTF8(p.idea), nonce, teamKey));
      body.ideaNonce = encodeBase64(nonce);
      const wrapNonce = nacl.randomBytes(nacl.box.nonceLength);
      wrapped = {
        encrypted_team_key: encodeBase64(nacl.box(teamKey, wrapNonce, naclUtil.decodeBase64(k.boxPub), k.boxSec)),
        nonce: encodeBase64(wrapNonce),
        sender_public_key: k.boxPub,
      };
    }
    const created = await postIdeaAs(ownerUser, body);
    projectIds.set(p.key, created);
    if (wrapped) {
      await rest('team_keys', {
        method: 'POST', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ project_id: created, user_id: owner, ...wrapped }),
      });
    }
  }
  console.log(`seed: ${projects.length} projects through post_idea, all embedded (${projects.filter((p) => p.visibility === 'private').length} private, encrypted)`);

  // Hack team shells, same shape ensure_hack_team() creates.
  const shells = new Map<string, string>();
  for (const u of users.filter((x) => x.hackNeeds)) {
    const [shell] = await rest('projects', {
      method: 'POST',
      body: JSON.stringify({ owner_id: ids.get(u.key), title: `${u.username}'s hack team`, short_pitch: '',
        type: 'hackathon', hidden: true, visibility: 'private' }),
    });
    shells.set(u.key, shell.id);
    await rest('project_roles', {
      method: 'POST', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(u.hackNeeds!.map((r) => ({ project_id: shell.id, role: r.role, slots_open: r.open }))),
    });
    await rest('team_members', {
      method: 'POST', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ project_id: shell.id, user_id: ids.get(u.key), role: u.role, ownership: 'owner' }),
    });
  }
  console.log(`seed: ${shells.size} hack teams`);

  // Swipes that set up the demo.
  const bob = ids.get('bob')!;
  const swipes = [
    // Judge swipe: Alice already liked Bob for Pocket Tutor, so Bob's right swipe on it is an instant match.
    { swiper_id: ids.get('alice'), target_id: bob, target_type: 'person', project_id: projectIds.get('tutor'), role: 'Backend', direction: 'right', is_super: false },
    // "Who wants you" on Bob's phone: two hack teams liked him, one with a Super Commit.
    { swiper_id: ids.get('rio'), target_id: bob, target_type: 'person', project_id: shells.get('rio'), role: 'Backend', direction: 'right', is_super: false },
    { swiper_id: ids.get('omar'), target_id: bob, target_type: 'person', project_id: shells.get('omar'), role: 'Backend', direction: 'right', is_super: true },
  ];
  await rest('swipes', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(swipes) });
  console.log('seed: demo swipes (Alice liked Bob for Pocket Tutor; rio and omar liked Bob in Hack mode)');
}

const resetOnly = process.argv.includes('--reset');
await reset();
if (!resetOnly) await seed();
console.log(resetOnly ? 'done: reset only' : 'done: clean demo state');
