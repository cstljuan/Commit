// End-to-end test for reliability events (0011_reliability.sql) against the hosted project.
//   npx tsx scripts/e2e/reliability.mts
// Reads scripts/.env (SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY).
// QA passwords live in scripts/.env.reliability (gitignored, created on first run). Override the path
// with RELIABILITY_ENV_FILE (useful from a git worktree).
// Accounts: qa_rel_owner and qa_rel_member on qa-commit.dev. Cleanup only touches those two ids.
//
// Flow: owner posts a public idea through post_idea (same path as the app), member swipes on it,
// owner swipes back, both commit, then complete_project (+5 each), refusals, and leave_team (-3)
// on a second project. Exits non-zero on any failure.

import { randomBytes } from 'node:crypto';
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

function readEnv(path: string): Record<string, string> {
  const env: Record<string, string> = {};
  if (!existsSync(path)) return env;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

const env = readEnv(join(here, '..', '.env'));
const relPath = process.env.RELIABILITY_ENV_FILE ?? join(here, '..', '.env.reliability');
const rel = readEnv(relPath);
for (const k of ['QA_REL_OWNER_PASSWORD', 'QA_REL_MEMBER_PASSWORD']) {
  if (!rel[k]) {
    rel[k] = randomBytes(15).toString('base64url');
    appendFileSync(relPath, `${k}=${rel[k]}\n`);
  }
}

const URL = env.SUPABASE_URL;
const PUB = env.SUPABASE_PUBLISHABLE_KEY;
const SECRET = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !PUB || !SECRET) throw new Error('scripts/.env needs SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY');

const DOMAIN = 'qa-commit.dev';
const OWNER = { email: `qa_rel_owner@${DOMAIN}`, password: rel.QA_REL_OWNER_PASSWORD, username: 'qa_rel_owner', role: 'PM' };
const MEMBER = { email: `qa_rel_member@${DOMAIN}`, password: rel.QA_REL_MEMBER_PASSWORD, username: 'qa_rel_member', role: 'Frontend' };

// ---------- tiny http helpers ----------

type Res = { ok: boolean; status: number; body: any };

async function call(path: string, init: RequestInit, headers: Record<string, string>): Promise<Res> {
  const res = await fetch(URL + path, { ...init, headers: { 'Content-Type': 'application/json', ...headers, ...(init.headers as any) } });
  const text = await res.text();
  let body: any = text;
  try { body = text ? JSON.parse(text) : null; } catch { /* plain text */ }
  return { ok: res.ok, status: res.status, body };
}

// Service key only ever goes in the apikey header.
const admin = (path: string, init: RequestInit = {}) => call(path, init, { apikey: SECRET });
const adminRest = (path: string, init: RequestInit = {}) =>
  admin('/rest/v1/' + path, { ...init, headers: { Prefer: 'return=representation', ...(init.headers as any) } });
const asUser = (jwt: string) => (path: string, init: RequestInit = {}) =>
  call(path, init, { apikey: PUB, Authorization: `Bearer ${jwt}` });
const anon = (path: string, init: RequestInit = {}) => call(path, init, { apikey: PUB });

const rpc = (fn: (p: string, i?: RequestInit) => Promise<Res>, name: string, args: object) =>
  fn(`/rest/v1/rpc/${name}`, { method: 'POST', body: JSON.stringify(args) });

// ---------- results ----------

let failed = 0;
let passed = 0;
function check(name: string, cond: boolean, detail?: unknown): void {
  if (cond) { passed++; console.log(`PASS  ${name}`); }
  else { failed++; console.log(`FAIL  ${name}${detail === undefined ? '' : '  ' + JSON.stringify(detail).slice(0, 300)}`); }
}
function must(name: string, r: Res): any {
  if (!r.ok) throw new Error(`${name} failed: ${r.status} ${JSON.stringify(r.body).slice(0, 300)}`);
  return r.body;
}

// ---------- setup and cleanup (QA ids only) ----------

async function findQaUsers(): Promise<{ id: string; email: string }[]> {
  const wanted = new Set([OWNER.email, MEMBER.email]);
  const out: { id: string; email: string }[] = [];
  for (let page = 1; page < 50; page++) {
    const r = must('list users', await admin(`/auth/v1/admin/users?page=${page}&per_page=200`));
    const list = r.users ?? [];
    out.push(...list.filter((u: any) => wanted.has(String(u.email ?? ''))));
    if (list.length < 200 || out.length === wanted.size) break;
  }
  return out;
}

async function cleanup(): Promise<void> {
  const qa = await findQaUsers();
  for (const u of qa) {
    // Projects first (cascades roles, swipes, matches, team rows, embeddings), then the auth user
    // (cascades profile and reliability_events). Scoped to these two QA ids only.
    must('delete qa projects', await adminRest(`projects?owner_id=eq.${u.id}`, { method: 'DELETE' }));
    must('delete qa user', await admin(`/auth/v1/admin/users/${u.id}`, { method: 'DELETE' }));
  }
  if (qa.length) console.log(`cleanup: removed ${qa.length} QA account(s) and their projects`);
}

async function createUser(u: typeof OWNER): Promise<{ id: string; jwt: string }> {
  const created = must('create user', await admin('/auth/v1/admin/users', {
    method: 'POST', body: JSON.stringify({ email: u.email, password: u.password, email_confirm: true }),
  }));
  const tok = must('sign in', await anon('/auth/v1/token?grant_type=password', {
    method: 'POST', body: JSON.stringify({ email: u.email, password: u.password }),
  }));
  const jwt = tok.access_token as string;
  must('create profile', await asUser(jwt)('/rest/v1/profiles', {
    method: 'POST',
    body: JSON.stringify({ id: created.id, name: u.username, username: u.username, primary_role: u.role, hours_per_week: 10 }),
  }));
  return { id: created.id, jwt };
}

async function postPublicIdea(jwt: string, label: string): Promise<string> {
  const tag = randomBytes(6).toString('hex');
  const r = await asUser(jwt)('/functions/v1/post_idea', {
    method: 'POST',
    body: JSON.stringify({
      title: `QA reliability ${label} ${tag}`,
      shortPitch: `QA test project ${tag}`,
      type: 'practice', theme: 'Tools', timeframe: 'weekend', visibility: 'public',
      roles: [{ role: 'Frontend', open: 1 }],
      fullIdea: `Automated reliability test ${label}, token ${tag}. Zebra quartz violin ${tag} marmalade.`,
    }),
  });
  const body = must(`post_idea ${label}`, r);
  if (!body?.projectId) throw new Error(`post_idea ${label}: no projectId ${JSON.stringify(body)}`);
  return body.projectId;
}

async function formTeam(owner: { id: string; jwt: string }, member: { id: string; jwt: string }, projectId: string): Promise<void> {
  const m = asUser(member.jwt), o = asUser(owner.jwt);
  must('member swipe', await rpc(m, 'record_swipe', {
    p_target_id: projectId, p_target_type: 'project', p_project_id: projectId, p_role: 'Frontend', p_direction: 'right',
  }));
  const back = must('owner swipe', await rpc(o, 'record_swipe', {
    p_target_id: member.id, p_target_type: 'person', p_project_id: projectId, p_role: 'Frontend', p_direction: 'right',
  }));
  if (!back?.matched || !back.matchId) throw new Error(`expected a match, got ${JSON.stringify(back)}`);
  must('owner commit', await rpc(o, 'commit_to_project', { p_match_id: back.matchId }));
  const done = must('member commit', await rpc(m, 'commit_to_project', { p_match_id: back.matchId }));
  if (!done?.both) throw new Error(`expected both committed, got ${JSON.stringify(done)}`);
}

const score = async (id: string): Promise<number> =>
  must('score', await adminRest(`profiles?select=reliability_score&id=eq.${id}`))[0]?.reliability_score;
const events = async (id: string): Promise<{ label: string; delta: number }[]> =>
  must('events', await adminRest(`reliability_events?select=label,delta&user_id=eq.${id}&order=created_at`));
const slots = async (projectId: string): Promise<number> =>
  must('slots', await adminRest(`project_roles?select=slots_open&project_id=eq.${projectId}&role=eq.Frontend`))[0]?.slots_open;

// Same math as getScoreEvents in lib/api.real.ts, read with the user's own token (RLS on reliability_events).
async function scoreEventsSum(jwt: string): Promise<{ sum: number; score: number }> {
  const u = asUser(jwt);
  const prof = must('own profile', await u('/rest/v1/profiles?select=id,reliability_score&limit=1&id=eq.' + JSON.parse(
    Buffer.from(jwt.split('.')[1], 'base64url').toString()).sub));
  const rows = must('own events', await u('/rest/v1/reliability_events?select=delta&order=created_at'));
  return { sum: 70 + rows.reduce((a: number, r: any) => a + r.delta, 0), score: prof[0]?.reliability_score };
}

// ---------- the test ----------

async function main(): Promise<void> {
  await cleanup();
  const owner = await createUser(OWNER);
  const member = await createUser(MEMBER);
  const o = asUser(owner.jwt), m = asUser(member.jwt);

  // Project 1: form a team, then complete it.
  const p1 = await postPublicIdea(owner.jwt, 'one');
  await formTeam(owner, member, p1);
  const team = must('team rows', await adminRest(`team_members?select=user_id,status,ownership&project_id=eq.${p1}`));
  check('team formed: owner and member active', team.length === 2 && team.every((t: any) => t.status === 'active'), team);
  check('member took the Frontend slot (slots_open 0)', (await slots(p1)) === 0);

  check('starting scores are 70', (await score(owner.id)) === 70 && (await score(member.id)) === 70);

  const anonTry = await rpc(anon, 'complete_project', { p_project: p1 });
  check('anon cannot call complete_project', !anonTry.ok, anonTry.status);
  const directAdjust = await rpc(m, 'adjust_reliability', { p_user: member.id, p_event: 'completed' });
  check('signed-in user cannot call adjust_reliability directly', !directAdjust.ok, directAdjust.status);

  const memberTry = await rpc(m, 'complete_project', { p_project: p1 });
  check('non-owner complete_project refused', !memberTry.ok, memberTry.body);

  const done = await rpc(o, 'complete_project', { p_project: p1 });
  check('owner complete_project returns { completed: true, members: 2 }',
    done.ok && done.body?.completed === true && done.body?.members === 2, done.body);
  check('owner score 75 after completion', (await score(owner.id)) === 75);
  check('member score 75 after completion', (await score(member.id)) === 75);
  const oe = await events(owner.id), me = await events(member.id);
  check('owner has one "Finished a project" +5 event',
    oe.length === 1 && oe[0].label === 'Finished a project' && oe[0].delta === 5, oe);
  check('member has one "Finished a project" +5 event',
    me.length === 1 && me[0].label === 'Finished a project' && me[0].delta === 5, me);

  const again = await rpc(o, 'complete_project', { p_project: p1 });
  check('second complete_project refused', !again.ok, again.body);
  check('scores unchanged after refused second call', (await score(owner.id)) === 75 && (await score(member.id)) === 75);

  const tamper = await o(`/rest/v1/projects?id=eq.${p1}`, {
    method: 'PATCH', body: JSON.stringify({ completed_at: null }), headers: { Prefer: 'return=representation' },
  });
  const stillDone = must('read p1', await adminRest(`projects?select=completed_at&id=eq.${p1}`))[0]?.completed_at;
  check('owner cannot clear completed_at directly', !tamper.ok && !!stillDone, tamper.body);

  const leaveDone = await rpc(m, 'leave_team', { p_project: p1 });
  check('leave_team on a completed project refused', !leaveDone.ok, leaveDone.body);

  // Project 2: form a team, member leaves with notice.
  const p2 = await postPublicIdea(owner.jwt, 'two');
  await formTeam(owner, member, p2);
  check('project 2 slot taken (slots_open 0)', (await slots(p2)) === 0);

  const ownerLeave = await rpc(o, 'leave_team', { p_project: p2 });
  check('owner leave_team refused', !ownerLeave.ok, ownerLeave.body);

  const left = await rpc(m, 'leave_team', { p_project: p2 });
  check('member leave_team returns { left: true }', left.ok && left.body?.left === true, left.body);
  const row = must('member row', await adminRest(`team_members?select=status&project_id=eq.${p2}&user_id=eq.${member.id}`))[0];
  check('member status is left', row?.status === 'left', row);
  check('member score 72 after leaving (75 - 3)', (await score(member.id)) === 72);
  const me2 = await events(member.id);
  check('member has a "Left a team with notice" -3 event',
    me2.length === 2 && me2[1].label === 'Left a team with notice' && me2[1].delta === -3, me2);
  check('Frontend slot re-opened on project 2 (slots_open 1)', (await slots(p2)) === 1);
  check('owner score unchanged by member leaving (75)', (await score(owner.id)) === 75);

  const leaveTwice = await rpc(m, 'leave_team', { p_project: p2 });
  check('second leave_team refused', !leaveTwice.ok, leaveTwice.body);
  check('member score still 72', (await score(member.id)) === 72);

  // getScoreEvents math: 70 + sum(events) must equal reliability_score, no "Seeded demo history" gap.
  const os = await scoreEventsSum(owner.jwt), ms = await scoreEventsSum(member.jwt);
  check('owner: 70 + events sum equals reliability_score', os.sum === os.score, os);
  check('member: 70 + events sum equals reliability_score', ms.sum === ms.score, ms);
}

let crashed = false;
try {
  await main();
} catch (e) {
  crashed = true;
  console.log(`FAIL  crashed: ${(e as Error).message}`);
} finally {
  try { await cleanup(); } catch (e) { console.log(`cleanup error: ${(e as Error).message}`); }
}

console.log(`\n${passed} passed, ${failed} failed${crashed ? ', crashed' : ''}`);
if (failed || crashed) { console.log('RELIABILITY E2E: FAIL'); process.exit(1); }
console.log('RELIABILITY E2E: PASS');
