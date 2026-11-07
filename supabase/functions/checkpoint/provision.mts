/** Run once, only after Shahd identifies our Supabase project and grants secrets access.
 * The private key passes through process memory and a pipe directly into Supabase secrets.
 * Only the public key is written to the app. Existing secrets/pins are never replaced.
 */
import { execFileSync, spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import nacl from 'tweetnacl';
import util from 'tweetnacl-util';

const ref = process.argv[2];
if (!ref || !/^[a-z]{20}$/.test(ref)) throw new Error('Supply the confirmed Commit Supabase project ref.');
const vaultPath = fileURLToPath(new URL('../../../lib/vault.ts', import.meta.url));
const source = readFileSync(vaultPath, 'utf8');
const placeholder = "export const SERVER_SIGNING_PUBLIC_KEY = '';";
if (!source.includes(placeholder)) throw new Error('A public key is already pinned. Do not rotate it.');
let secrets: unknown;
try {
  secrets = JSON.parse(execFileSync('supabase', ['secrets', 'list', '--project-ref', ref, '--output', 'json'], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  }));
} catch { throw new Error('Cannot inspect project secrets. Confirm project access before provisioning.'); }
if (!Array.isArray(secrets)) throw new Error('Unrecognized secrets list. Inspect the CLI output safely before proceeding.');
if (secrets.some(value => value?.name === 'SERVER_SIGNING_SECRET')) throw new Error('SERVER_SIGNING_SECRET already exists. Do not replace it.');
const pair = nacl.sign.keyPair();
const child = spawn('supabase', ['secrets', 'set', '--project-ref', ref, '--env-file', '/dev/stdin'], {
  stdio: ['pipe', 'pipe', 'pipe'],
});
// Suppress CLI output because an unexpected error could quote the input.
child.stdout.resume();
child.stderr.resume();
child.stdin.on('error', () => {});
child.stdin.end(`SERVER_SIGNING_SECRET=${util.encodeBase64(pair.secretKey)}\n`);
await new Promise<void>((resolve, reject) => {
  child.on('error', () => reject(new Error('Could not start the Supabase CLI. No public key was written.')));
  child.on('close', code => code === 0 ? resolve() : reject(new Error('Secret provisioning failed. No public key was written.')));
});
const publicKey = util.encodeBase64(pair.publicKey);
pair.secretKey.fill(0);
try {
  writeFileSync(vaultPath, source.replace(placeholder, `export const SERVER_SIGNING_PUBLIC_KEY = '${publicKey}';`));
} catch {
  throw new Error(`Signer stored, but public-key file write failed. Pin this PUBLIC key manually: ${publicKey}`);
}
console.log('Signer stored in Supabase secrets; public key pinned in lib/vault.ts. Commit the public-key change before deploying.');
