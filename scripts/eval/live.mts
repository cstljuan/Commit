// Live check of copy detection through the deployed post_idea path (shares core.ts and COPY_THRESHOLD with v2).
//   npx tsx scripts/eval/live.mts
// Posts 2 rewrites of seeded demo projects and 1 unrelated idea as a throwaway QA account, through post_idea_v1
// (v1 is the only version that reports the match, v2 answers "submitted" either way). Posts are hidden.
// Afterwards it deletes everything the QA account made, then the QA account itself. Nothing else is touched.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const readEnv = (p: string) => {
  const env: Record<string, string> = {};
  if (!existsSync(p)) return env;
  for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
};
const env = readEnv(join(here, '..', '.env'));
const URL = env.SUPABASE_URL;
const SVC = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, 'Content-Type': 'application/json' };
const PUB = env.SUPABASE_PUBLISHABLE_KEY;

// The QA password lives only in the main checkout's gitignored scripts/.env.eval-final.
const QA_EMAIL = 'qa_eval@qa-commit.dev';
const qaEnvPath = process.env.QA_ENV_FILE ?? 'C:/PlutoHacks-2026/Plutohacks-2026/scripts/.env.eval-final';
let qaPassword = readEnv(qaEnvPath).QA_EVAL_PASSWORD;
if (!qaPassword) {
  qaPassword = randomBytes(18).toString('base64url');
  writeFileSync(qaEnvPath, `QA_EVAL_EMAIL=${QA_EMAIL}\nQA_EVAL_PASSWORD=${qaPassword}\n`);
}

const posts = [
  { label: 'rewrite of Pocket Tutor (public seed)', expect: 'Pocket Tutor',
    idea: 'Students upload class notes and the app quizzes them, bringing back the facts they keep getting wrong with spaced repetition.' },
  { label: 'rewrite of CTF Coach (private seed)', expect: 'CTF Coach',
    idea: 'Practice CTF challenges for beginners where each hint level teaches the underlying vulnerability rather than giving the answer.' },
  { label: 'unrelated', expect: null,
    idea: 'A marketplace where neighbors rent out unused garden tools and lawn mowers by the hour.' },
];

async function signIn(): Promise<{ token: string; id: string } | null> {
  const r = await fetch(URL + '/auth/v1/token?grant_type=password', {
    method: 'POST', headers: { apikey: PUB, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: QA_EMAIL, password: qaPassword }),
  });
  if (!r.ok) return null;
  const j = (await r.json()) as { access_token: string; user: { id: string } };
  return { token: j.access_token, id: j.user.id };
}

let session = await signIn();
if (!session) {
  const r = await fetch(URL + '/auth/v1/admin/users', {
    method: 'POST', headers: SVC, body: JSON.stringify({ email: QA_EMAIL, password: qaPassword, email_confirm: true }),
  });
  if (!r.ok) throw new Error(`create QA user ${r.status}: ${await r.text()}`);
  session = await signIn();
  if (!session) throw new Error('QA sign in failed after create');
}
const qaId = session.id;
const prof = await fetch(URL + '/rest/v1/profiles', {
  method: 'POST', headers: { ...SVC, Prefer: 'resolution=merge-duplicates,return=minimal' },
  body: JSON.stringify({ id: qaId, name: 'QA Eval' }),
});
if (!prof.ok) throw new Error(`QA profile ${prof.status}: ${await prof.text()}`);

let failures = 0;
try {
  for (const p of posts) {
    const r = await fetch(URL + '/functions/v1/post_idea_v1', {
      method: 'POST',
      headers: { apikey: PUB, Authorization: `Bearer ${session.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'QA eval post', shortPitch: 'QA eval, deleted after the run', fullIdea: p.idea, visibility: 'public', hidden: true }),
    });
    const j = (await r.json()) as { similarTitle?: string | null; similarity?: number | null; status?: string };
    const flagged = j.similarTitle ?? null;
    const ok = r.ok && flagged === p.expect;
    if (!ok) failures++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${p.label}: http ${r.status}, flagged ${flagged ?? 'nothing'}${j.similarity != null ? ` at ${j.similarity.toFixed(3)}` : ''}`);
  }
} finally {
  // Cleanup, scoped to the QA account only.
  for (const path of [`copy_alerts?copier_id=eq.${qaId}`, `projects?owner_id=eq.${qaId}`]) {
    const d = await fetch(`${URL}/rest/v1/${path}`, { method: 'DELETE', headers: SVC });
    if (!d.ok) console.log(`cleanup ${path.split('?')[0]} ${d.status}: ${await d.text()}`);
  }
  const du = await fetch(`${URL}/auth/v1/admin/users/${qaId}`, { method: 'DELETE', headers: SVC });
  const left = await fetch(`${URL}/rest/v1/projects?owner_id=eq.${qaId}&select=id`, { headers: SVC });
  const n = ((await left.json()) as unknown[]).length;
  console.log(`cleanup: QA user deleted ${du.ok ? 'yes' : `NO (${du.status})`}, QA projects left ${n}`);
}
process.exit(failures ? 1 : 0);
