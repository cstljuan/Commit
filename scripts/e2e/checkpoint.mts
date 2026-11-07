// End-to-end test for the deployed vault checkpoint signer (supabase/functions/checkpoint).
// Run: npx tsx scripts/e2e/checkpoint.mts
//
// Reads scripts/.env (SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY) and
// scripts/.env.checkpoint (QA_CKPT_EMAIL, QA_CKPT_PASSWORD, optional QA_CKPT_SIGN_SECRET). Both are gitignored.
// The QA account is a throwaway on qa-commit.dev. If the vault is empty, it registers its own device keys,
// posts one public idea and appends one signed vault entry, exactly like the app does.
// Then it calls checkpoint signed in, reads the newest vault_checkpoints row and verifies it with the
// public key pinned in lib/vault.ts, using a Node copy of verifyVaultSnapshot (lib/vault.ts imports expo).
import { createHash, randomBytes } from 'node:crypto';
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import nacl from 'tweetnacl';
import util from 'tweetnacl-util';

const { decodeBase64, decodeUTF8, encodeBase64 } = util;
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');

function loadEnv(path: string): Record<string, string> {
  const env: Record<string, string> = {};
  if (!existsSync(path)) return env;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line);
    if (m) env[m[1]] = m[2].trim().replace(/^"|"$/g, '');
  }
  return env;
}
const env = loadEnv(join(root, 'scripts', '.env'));
// From a worktree, point QA_CKPT_ENV at the main checkout's scripts/.env.checkpoint.
const qaPath = process.env.QA_CKPT_ENV ?? join(root, 'scripts', '.env.checkpoint');
const qa = loadEnv(qaPath);
const URL = env.SUPABASE_URL;
const PUB = env.SUPABASE_PUBLISHABLE_KEY;
const SECRET = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !PUB || !SECRET) throw new Error('scripts/.env needs SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY');
if (!qa.QA_CKPT_EMAIL || !qa.QA_CKPT_PASSWORD) throw new Error(`${qaPath} needs QA_CKPT_EMAIL and QA_CKPT_PASSWORD`);

// The pinned key is read from the app source, never from the API.
const vaultSource = readFileSync(join(root, 'lib', 'vault.ts'), 'utf8');
const SERVER_SIGNING_PUBLIC_KEY = /export const SERVER_SIGNING_PUBLIC_KEY = '([^']*)';/.exec(vaultSource)?.[1] ?? '';

let passed = 0, failed = 0;
function check(name: string, ok: boolean, detail = '') {
  if (ok) { passed++; console.log(`PASS  ${name}`); } else { failed++; console.log(`FAIL  ${name}${detail ? `: ${detail}` : ''}`); }
}

// ---- Node copy of lib/vault.ts verification (keep in sync) ----
type VaultEntry = { seq: number; project_id: string; author_id: string; idea_hash: string; ts: string; author_sig: string; prev_hash: string; entry_hash: string };
type VaultCheckpoint = { last_seq: number; last_entry_hash: string; server_sig: string };
type Verification = { seq: number; ok: boolean; reason?: string };
const sha256 = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex');
const vaultContent = (projectId: string, authorId: string, ideaHash: string, ts: string) =>
  `${projectId}|${authorId}|${ideaHash}|${new Date(ts).toISOString()}`;
function verifyContent(content: string, signature: string, publicKey: string): boolean {
  try { return nacl.sign.detached.verify(decodeUTF8(content), decodeBase64(signature), decodeBase64(publicKey)); } catch { return false; }
}
function verifyVaultSnapshot(rows: VaultEntry[], publicKeys: Record<string, string>, checkpoint: VaultCheckpoint | null,
  serverPublicKey = SERVER_SIGNING_PUBLIC_KEY): Verification[] {
  const results: Verification[] = [];
  let previous = '0'.repeat(64);
  let previousSeq = 0;
  let broken = false;
  for (const row of rows) {
    let reason: string | undefined;
    try {
      const content = vaultContent(row.project_id, row.author_id, row.idea_hash, row.ts);
      if (!Number.isSafeInteger(row.seq) || row.seq <= previousSeq || row.prev_hash !== previous || broken) reason = 'chain broken';
      else if (sha256(`${content}|${previous}`) !== row.entry_hash) reason = 'entry edited';
      else if (!publicKeys[row.author_id] || !verifyContent(content, row.author_sig, publicKeys[row.author_id])) reason = 'signature invalid';
    } catch { reason = 'entry edited'; }
    results.push({ seq: row.seq, ok: !reason, ...(reason ? { reason } : {}) });
    broken ||= Boolean(reason);
    previous = row.entry_hash;
    previousSeq = row.seq;
  }
  if (checkpoint) {
    const anchored = rows.find(row => row.seq === checkpoint.last_seq);
    if (!serverPublicKey || !anchored || anchored.entry_hash !== checkpoint.last_entry_hash ||
      !verifyContent(`${checkpoint.last_seq}|${checkpoint.last_entry_hash}`, checkpoint.server_sig, serverPublicKey)) {
      results.push({ seq: checkpoint.last_seq, ok: false, reason: 'checkpoint invalid' });
    }
  } else {
    results.push({ seq: rows.at(-1)?.seq ?? 0, ok: false, reason: 'checkpoint unavailable' });
  }
  return results;
}
// ---- end copy ----

async function call(path: string, init: RequestInit & { token?: string; admin?: boolean } = {}) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', apikey: init.admin ? SECRET : PUB };
  if (init.token) headers.Authorization = `Bearer ${init.token}`;
  const res = await fetch(URL + path, { ...init, headers: { ...headers, ...(init.headers as Record<string, string>) } });
  const text = await res.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { status: res.status, body };
}
async function must(path: string, init: Parameters<typeof call>[1] = {}) {
  const r = await call(path, init);
  if (r.status >= 300) throw new Error(`${init.method ?? 'GET'} ${path.split('?')[0]} ${r.status}: ${JSON.stringify(r.body).slice(0, 200)}`);
  return r.body;
}

async function signIn(): Promise<{ token: string; id: string }> {
  let r = await call('/auth/v1/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email: qa.QA_CKPT_EMAIL, password: qa.QA_CKPT_PASSWORD }) });
  if (!r.body?.access_token) {
    // First run: create the throwaway QA account (admin API, secret key as apikey only).
    await must('/auth/v1/admin/users', { method: 'POST', admin: true, body: JSON.stringify({ email: qa.QA_CKPT_EMAIL, password: qa.QA_CKPT_PASSWORD, email_confirm: true }) });
    r = await call('/auth/v1/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email: qa.QA_CKPT_EMAIL, password: qa.QA_CKPT_PASSWORD }) });
  }
  if (!r.body?.access_token) throw new Error(`QA sign in failed: ${r.status}`);
  return { token: r.body.access_token, id: r.body.user.id };
}

/** Makes sure the vault has at least one entry. Signs like lib/vault.ts appendVault. */
async function ensureVaultEntry(token: string, id: string) {
  const head = await must('/rest/v1/vault_log?select=seq&order=seq.desc&limit=1', { token });
  if (head.length) { console.log(`info  vault head is seq ${head[0].seq}, no append needed`); return; }

  const profile = (await must(`/rest/v1/profiles?select=id,sign_public_key&id=eq.${id}`, { token }))[0];
  let signSecret = qa.QA_CKPT_SIGN_SECRET ? decodeBase64(qa.QA_CKPT_SIGN_SECRET) : undefined;
  if (!signSecret) {
    if (profile?.sign_public_key) throw new Error('QA profile has signing keys but QA_CKPT_SIGN_SECRET is missing');
    const sign = nacl.sign.keyPair();
    signSecret = sign.secretKey;
    // Throwaway QA device key, kept only in the gitignored QA env file so reruns can append again.
    appendFileSync(qaPath, `QA_CKPT_SIGN_SECRET=${encodeBase64(sign.secretKey)}\n`);
  }
  const signPublic = encodeBase64(nacl.sign.keyPair.fromSecretKey(signSecret).publicKey);
  if (!profile) {
    await must('/rest/v1/profiles', { method: 'POST', token, headers: { Prefer: 'return=minimal' }, body: JSON.stringify({
      id, name: 'QA Checkpoint', box_public_key: encodeBase64(nacl.box.keyPair().publicKey), sign_public_key: signPublic,
    }) });
  } else if (!profile.sign_public_key) {
    await must(`/rest/v1/profiles?id=eq.${id}`, { method: 'PATCH', token, headers: { Prefer: 'return=minimal' }, body: JSON.stringify({
      box_public_key: encodeBase64(nacl.box.keyPair().publicKey), sign_public_key: signPublic,
    }) });
  } else if (profile.sign_public_key !== signPublic) throw new Error('QA profile signing key does not match QA_CKPT_SIGN_SECRET');

  const idea = `QA checkpoint test idea ${randomBytes(6).toString('hex')}: a synthetic entry used only to test the vault signer.`;
  const post = await must('/functions/v1/post_idea', { method: 'POST', token, body: JSON.stringify({
    title: 'QA checkpoint test', shortPitch: 'Synthetic QA project for the vault checkpoint test.', type: 'practice',
    visibility: 'public', hidden: true, fullIdea: idea, roles: [],
  }) });
  const projectId = post.projectId as string;
  const ts = new Date().toISOString(); // current time (W2 may bound ts to now() +- minutes)
  const ideaHash = sha256(`${ts}::${idea}`);
  const sig = encodeBase64(nacl.sign.detached(decodeUTF8(vaultContent(projectId, id, ideaHash, ts)), signSecret));
  const entry = await must('/rest/v1/rpc/append_vault_entry', { method: 'POST', token, body: JSON.stringify({ p_project: projectId, p_idea_hash: ideaHash, p_ts: ts, p_sig: sig }) });
  console.log(`info  appended vault entry seq ${entry.seq} for QA project ${projectId}`);
}

async function main() {
  check('SERVER_SIGNING_PUBLIC_KEY is pinned (32 byte ed25519 key)', (() => { try { return decodeBase64(SERVER_SIGNING_PUBLIC_KEY).length === 32; } catch { return false; } })());
  const { token, id } = await signIn();
  await ensureVaultEntry(token, id);

  const anon = await call('/functions/v1/checkpoint', { method: 'POST', body: '{}' });
  check('checkpoint without a user token is rejected (401)', anon.status === 401, `got ${anon.status}`);

  const res = await call('/functions/v1/checkpoint', { method: 'POST', token, body: JSON.stringify({ last_seq: 999999, last_entry_hash: 'f'.repeat(64) }) });
  check('checkpoint signed in returns 200', res.status === 200, `got ${res.status} ${JSON.stringify(res.body)}`);

  const [latest] = await must('/rest/v1/vault_checkpoints?select=last_seq,last_entry_hash,server_sig&order=last_seq.desc,id.desc&limit=1', { token });
  const rows: VaultEntry[] = [];
  for (let offset = 0; ; offset += 500) {
    const page = await must(`/rest/v1/vault_log?select=*&order=seq&offset=${offset}&limit=500`, { token });
    rows.push(...page);
    if (page.length < 500) break;
  }
  const keys = await must('/rest/v1/rpc/vault_signing_keys', { method: 'POST', token, body: '{}' });
  const publicKeys: Record<string, string> = {};
  for (const k of keys) if (k.sign_public_key) publicKeys[k.author_id] = k.sign_public_key;
  const head = rows.at(-1)!;

  check('returned checkpoint matches the newest stored row', !!latest && res.body?.last_seq === latest.last_seq && res.body?.server_sig === latest.server_sig);
  check('caller supplied fields are ignored (signed seq is the real head)', latest?.last_seq === head.seq && latest?.last_entry_hash === head.entry_hash);
  check('signature verifies with the pinned key over last_seq|last_entry_hash',
    verifyContent(`${latest.last_seq}|${latest.last_entry_hash}`, latest.server_sig, SERVER_SIGNING_PUBLIC_KEY));
  const good = verifyVaultSnapshot(rows, publicKeys, latest);
  check(`verifyVaultSnapshot is all green (${rows.length} entries + checkpoint)`, good.every(r => r.ok) && good.length === rows.length,
    JSON.stringify(good.filter(r => !r.ok)));

  const tamperedHash = { ...latest, last_entry_hash: latest.last_entry_hash.replace(/^./, c => (c === '0' ? '1' : '0')) };
  check('tampered last_entry_hash fails verification', verifyVaultSnapshot(rows, publicKeys, tamperedHash).some(r => r.reason === 'checkpoint invalid'));
  const sigBytes = decodeBase64(latest.server_sig); sigBytes[0] ^= 1;
  const tamperedSig = { ...latest, server_sig: encodeBase64(sigBytes) };
  check('tampered server_sig fails verification', verifyVaultSnapshot(rows, publicKeys, tamperedSig).some(r => r.reason === 'checkpoint invalid'));
  check('a different signer key fails verification',
    verifyVaultSnapshot(rows, publicKeys, latest, encodeBase64(nacl.sign.keyPair().publicKey)).some(r => r.reason === 'checkpoint invalid'));
  const editedRows = rows.map(r => r.seq === head.seq ? { ...r, ts: new Date(new Date(r.ts).getTime() + 1000).toISOString() } : r);
  check('an edited vault entry (ts moved 1s) fails verification', verifyVaultSnapshot(editedRows, publicKeys, latest).some(r => !r.ok));

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}
main().catch(e => { console.error('ERROR', e instanceof Error ? e.message : e); process.exit(1); });
