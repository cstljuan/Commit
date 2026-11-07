import { test } from 'node:test';
import assert from 'node:assert/strict';
import nacl from 'tweetnacl';
import util from 'tweetnacl-util';
const { decodeBase64, decodeUTF8, encodeBase64 } = util;
import { createCheckpointHandler, type Checkpoint, type Head } from './handler.ts';

const pair = nacl.sign.keyPair();
const hash = 'a'.repeat(64);
function fixture(head: Head | null = { seq: 5, entry_hash: hash }) {
  const inserted: Checkpoint[] = [];
  let reads = 0;
  const handler = createCheckpointHandler({
    authenticate: async token => token === 'valid',
    readHead: async () => { reads++; return head; },
    sign: content => encodeBase64(nacl.sign.detached(decodeUTF8(content), pair.secretKey)),
    insert: async value => { inserted.push(value); },
  });
  return { handler, inserted, reads: () => reads };
}
const request = (token = 'valid', method = 'POST', body?: string) => new Request('https://commit.test/checkpoint', {
  method, headers: token ? { Authorization: `Bearer ${token}` } : {}, ...(body ? { body } : {}),
});
test('only a validated bearer token may read or sign the head', async () => {
  const f = fixture();
  assert.equal((await f.handler(request('', 'POST'))).status, 401);
  assert.equal((await f.handler(request('invalid'))).status, 401);
  assert.equal((await f.handler(request('valid', 'GET'))).status, 405);
  assert.equal(f.reads(), 0);
  assert.equal(f.inserted.length, 0);
});
test('signs database head and ignores caller-supplied checkpoint fields', async () => {
  const f = fixture();
  const response = await f.handler(request('valid', 'POST', JSON.stringify({ last_seq: 99, last_entry_hash: 'forged' })));
  assert.equal(response.status, 200);
  const cp = await response.json();
  assert.equal(cp.last_seq, 5);
  assert.equal(cp.last_entry_hash, hash);
  assert(nacl.sign.detached.verify(decodeUTF8(`5|${hash}`), decodeBase64(cp.server_sig), pair.publicKey));
  assert(!nacl.sign.detached.verify(decodeUTF8(`99|${hash}`), decodeBase64(cp.server_sig), pair.publicKey));
  assert.deepEqual(f.inserted, [cp]);
});
test('empty and malformed heads never receive signatures', async () => {
  for (const head of [null, { seq: NaN, entry_hash: hash }, { seq: 1, entry_hash: 'forged' }]) {
    const f = fixture(head);
    assert.equal((await f.handler(request())).status, 409);
    assert.equal(f.inserted.length, 0);
  }
});
test('failures return a generic response without sensitive details', async () => {
  const handler = createCheckpointHandler({
    authenticate: async () => true,
    readHead: async () => { throw new Error('private database configuration'); },
    sign: () => { throw new Error('must not sign'); }, insert: async () => {},
  });
  const response = await handler(request());
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: 'Checkpoint unavailable' });
});
