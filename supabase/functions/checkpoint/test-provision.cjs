const { mkdtempSync, mkdirSync, readFileSync, writeFileSync, symlinkSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { spawnSync } = require('node:child_process');
const assert = require('node:assert/strict');
const root = resolve(__dirname, '../../..');
const fixture = mkdtempSync(join(tmpdir(), 'commit-provision-'));
try {
  mkdirSync(join(fixture, 'supabase/functions/checkpoint'), { recursive: true });
  mkdirSync(join(fixture, 'lib'));
  mkdirSync(join(fixture, 'bin'));
  symlinkSync(join(root, 'node_modules'), join(fixture, 'node_modules'));
  const script = join(fixture, 'supabase/functions/checkpoint/provision.mts');
  writeFileSync(script, readFileSync(join(__dirname, 'provision.mts')));
  const vault = join(fixture, 'lib/vault.ts');
  const placeholder = "export const SERVER_SIGNING_PUBLIC_KEY = '';";
  writeFileSync(vault, placeholder);
  // Fake CLI: keys exist only in this child's memory; no secrets or key material are recorded.
  writeFileSync(join(fixture, 'bin/supabase'), `#!/usr/bin/python3
import sys,os,json,base64
if sys.argv[2]=='list':
 print(json.dumps([{'name':'SERVER_SIGNING_SECRET'}] if os.environ.get('TEST_EXISTING') else []))
 sys.exit(0)
if sys.argv[2]!='set' or '/dev/stdin' not in sys.argv: sys.exit(2)
value=sys.stdin.read().strip().split('=',1)
sys.exit(0 if len(value)==2 and value[0]=='SERVER_SIGNING_SECRET' and len(base64.b64decode(value[1]))==64 else 3)
`, { mode: 0o700 });
  const run = extra => spawnSync(process.execPath, ['--import', 'tsx', script, 'abcdefghijklmnopqrst'], {
    cwd: fixture, encoding: 'utf8', env: { ...process.env, PATH: join(fixture, 'bin') + ':' + process.env.PATH, ...extra },
  });
  const existing = run({ TEST_EXISTING: '1' });
  assert.notEqual(existing.status, 0);
  assert.equal(readFileSync(vault, 'utf8'), placeholder);
  const created = run({ TEST_EXISTING: '' });
  assert.equal(created.status, 0, created.stderr);
  const publicKey = /KEY = '([^']+)'/.exec(readFileSync(vault, 'utf8'))?.[1];
  assert.equal(Buffer.from(publicKey, 'base64').length, 32);
  assert(!created.stdout.includes('SERVER_SIGNING_SECRET='));
  const retry = run({ TEST_EXISTING: '' });
  assert.notEqual(retry.status, 0);
  console.log('YES: provisioning refuses existing secret/pin; private key passes via stdin; only the public key is written. Fake CLI, no hosted changes.');
} finally {
  rmSync(fixture, { recursive: true, force: true });
}
