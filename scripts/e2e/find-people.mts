// Find people on the live backend, end to end, with two QA accounts (juan-claude, Nov 7).
// Runs exactly what app/find.tsx calls: search by username, "I want in" on a project, "Invite to" a
// project, and checks the second add makes a match. Prints YES/NO per step and cleans up after itself.
//
// Needs the same secrets as scripts/e2e/signed-in.mts (run that once first if they do not exist):
//   scripts/.env                 SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY
//   scripts/.env.e2e-harness     QA_ALICE_EMAIL / QA_ALICE_PASSWORD, QA_BOB_EMAIL / QA_BOB_PASSWORD
// Run: npx tsx scripts/e2e/find-people.mts
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const here = dirname(fileURLToPath(import.meta.url));
const scripts = process.env.QA_SECRETS_DIR ?? join(here, '..');
const readEnv = (path: string): Record<string, string> => {
  const out: Record<string, string> = {};
  if (!existsSync(path)) return out;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
};
const env = { ...readEnv(join(scripts, '.env')), ...readEnv(join(scripts, '.env.e2e-harness')) };
const URL_ = env.SUPABASE_URL;
const ANON = env.SUPABASE_PUBLISHABLE_KEY;
const SECRET = env.SUPABASE_SERVICE_ROLE_KEY;
for (const k of ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'QA_ALICE_EMAIL', 'QA_ALICE_PASSWORD', 'QA_BOB_EMAIL', 'QA_BOB_PASSWORD']) {
  if (!env[k]) throw new Error(`missing ${k}: run scripts/e2e/signed-in.mts once to create the QA secrets`);
}

const svc = async (path: string, init: RequestInit = {}) => {
  const res = await fetch(`${URL_}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SECRET, Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(init.headers as Record<string, string>) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path.split('?')[0]} ${res.status}: ${text.slice(0, 160)}`);
  return text ? JSON.parse(text) : null;
};

type Row = { step: string; ok: boolean; detail: string };
const rows: Row[] = [];
const check = async (step: string, fn: () => Promise<string | void>) => {
  try {
    rows.push({ step, ok: true, detail: (await fn()) ?? '' });
    return true;
  } catch (e) {
    rows.push({ step, ok: false, detail: (e as Error).message.slice(0, 160) });
    return false;
  }
};
const must = (cond: unknown, msg: string) => {
  if (!cond) throw new Error(msg);
};

type Who = { client: SupabaseClient; id: string; username: string };
async function signIn(email: string, password: string): Promise<Who> {
  const client = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.user) throw new Error(`sign in ${email.split('@')[0]}: ${error?.message}`);
  const { data: prof } = await client.from('profiles').select('username').eq('id', data.user.id).maybeSingle();
  must(prof?.username, `${email.split('@')[0]} has no profile yet: run signed-in.mts first`);
  return { client, id: data.user.id, username: prof!.username as string };
}

let projectId = '';
let a: Who | null = null;
let b: Who | null = null;
try {
  await check('sign in two QA accounts', async () => {
    a = await signIn(env.QA_ALICE_EMAIL, env.QA_ALICE_PASSWORD);
    b = await signIn(env.QA_BOB_EMAIL, env.QA_BOB_PASSWORD);
    return `@${a.username}, @${b.username}`;
  });
  must(a && b, 'sign in failed, cannot continue');
  const A = a as unknown as Who;
  const B = b as unknown as Who;

  await check('A owns a fresh project (made with the service key, no vault entry)', async () => {
    const [p] = await svc('projects', { method: 'POST', body: JSON.stringify({ owner_id: A.id, title: 'QA find people', short_pitch: 'QA test, safe to ignore', type: 'original' }) });
    projectId = p.id;
    return projectId.slice(0, 8);
  });

  await check('B finds A by username (search as the app does)', async () => {
    const q = A.username.slice(0, Math.max(2, A.username.length - 2));
    const { data, error } = await B.client.from('profiles').select('id, username, primary_role').ilike('username', `%${q}%`).neq('id', B.id).limit(20);
    if (error) throw new Error(error.message);
    must((data ?? []).some((r) => r.id === A.id), `A not in ${data?.length ?? 0} results for "${q}"`);
    return `${data!.length} results for "${q}"`;
  });

  await check("B sees A's projects", async () => {
    const { data, error } = await B.client.from('projects').select('id, title').eq('owner_id', A.id).or('type.is.null,type.neq.hackathon');
    if (error) throw new Error(error.message);
    must((data ?? []).some((p) => p.id === projectId), 'fresh project not visible to B');
    return `${data!.length} project(s)`;
  });

  await check('B taps "I want in": no match yet', async () => {
    const { data, error } = await B.client.rpc('record_swipe', { p_target_id: projectId, p_target_type: 'project', p_project_id: projectId, p_role: null, p_direction: 'right' });
    if (error) throw new Error(error.message);
    must((data as { matched: boolean }).matched === false, 'matched too early');
    return 'request sent';
  });

  await check('A finds B by username', async () => {
    const { data, error } = await A.client.from('profiles').select('id').ilike('username', `%${B.username}%`).neq('id', A.id);
    if (error) throw new Error(error.message);
    must((data ?? []).some((r) => r.id === B.id), 'B not found');
  });

  let matchId = '';
  await check('A taps "Invite to" the project: it is a match', async () => {
    const { data, error } = await A.client.rpc('record_swipe', { p_target_id: B.id, p_target_type: 'person', p_project_id: projectId, p_role: null, p_direction: 'right' });
    if (error) throw new Error(error.message);
    const r = data as { matched: boolean; matchId?: string };
    must(r.matched && r.matchId, `no match: ${JSON.stringify(r)}`);
    matchId = r.matchId!;
    return `match ${matchId.slice(0, 8)}`;
  });

  await check('both sides can read the match row', async () => {
    const [{ data: ma }, { data: mb }] = await Promise.all([
      A.client.from('matches').select('id').eq('id', matchId).maybeSingle(),
      B.client.from('matches').select('id').eq('id', matchId).maybeSingle(),
    ]);
    must(ma?.id && mb?.id, `A sees ${!!ma?.id}, B sees ${!!mb?.id}`);
  });

  await check('an outsider cannot invite on A\'s behalf', async () => {
    const { error } = await B.client.rpc('record_swipe', { p_target_id: A.id, p_target_type: 'person', p_project_id: projectId, p_role: null, p_direction: 'right' });
    must(error, 'B recruited for a project B does not own');
    return 'denied';
  });
} finally {
  if (projectId) {
    await svc(`matches?project_id=eq.${projectId}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }).catch(() => {});
    await svc(`swipes?project_id=eq.${projectId}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }).catch(() => {});
    await svc(`projects?id=eq.${projectId}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }).catch(() => {});
  }
}

for (const r of rows) console.log(`${r.ok ? 'YES' : 'NO '}  ${r.step}${r.detail ? `  (${r.detail})` : ''}`);
const failed = rows.filter((r) => !r.ok).length;
console.log(failed ? `\n${failed} step(s) failed` : `\nAll ${rows.length} YES. Cleaned up the test project, swipes and match.`);
process.exit(failed ? 1 : 0);
