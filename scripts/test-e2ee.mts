// Tests the real end-to-end encryption code, with real keys. Run: npx tsx scripts/test-e2ee.mts
import assert from 'node:assert/strict';
import { test } from 'node:test';

import nacl from 'tweetnacl';
import naclUtil from 'tweetnacl-util';

import { checkPin, isSealed, open, orderedPair, safetyNumber, seal } from '../lib/e2eeCore.ts';

const person = () => {
  const keys = nacl.box.keyPair();
  return { pub: naclUtil.encodeBase64(keys.publicKey), secret: keys.secretKey };
};
const alice = person();
const bob = person();
const eve = person();
const MATCH = 'match-1';
const TEXT = 'our idea is a quiz app, dont tell anyone';

test('both people can read it, including the sender', () => {
  const body = seal(TEXT, MATCH, alice.pub, bob.pub, alice.secret);
  assert.equal(open(body, MATCH, alice.pub, alice.pub, bob.secret), TEXT);
  assert.equal(open(body, MATCH, alice.pub, bob.pub, alice.secret), TEXT);
});

test('the server only ever sees ciphertext', () => {
  const body = seal(TEXT, MATCH, alice.pub, bob.pub, alice.secret);
  assert.ok(isSealed(body));
  assert.ok(!body.includes('quiz'));
  assert.ok(!body.includes(MATCH));
  assert.ok(!body.includes(alice.pub));
});

test('a third person cannot read it', () => {
  const body = seal(TEXT, MATCH, alice.pub, bob.pub, alice.secret);
  assert.throws(() => open(body, MATCH, alice.pub, alice.pub, eve.secret), /decrypt/);
  assert.throws(() => open(body, MATCH, alice.pub, eve.pub, bob.secret), /decrypt/);
});

test('changing one byte is detected', () => {
  const body = seal(TEXT, MATCH, alice.pub, bob.pub, alice.secret);
  const flipped = body.slice(0, -6) + (body.at(-6) === 'A' ? 'B' : 'A') + body.slice(-5);
  assert.throws(() => open(flipped, MATCH, alice.pub, alice.pub, bob.secret));
});

test('a message cannot be replayed into another chat', () => {
  const body = seal(TEXT, MATCH, alice.pub, bob.pub, alice.secret);
  assert.throws(() => open(body, 'match-2', alice.pub, alice.pub, bob.secret), /another chat/);
});

test('your own message cannot be reflected back as theirs', () => {
  const body = seal(TEXT, MATCH, alice.pub, bob.pub, alice.secret);
  assert.throws(() => open(body, MATCH, bob.pub, bob.pub, alice.secret), /sender/);
});

test('the same text never encrypts the same way twice', () => {
  assert.notEqual(seal(TEXT, MATCH, alice.pub, bob.pub, alice.secret), seal(TEXT, MATCH, alice.pub, bob.pub, alice.secret));
});

test('a plain message is not treated as encrypted', () => {
  assert.throws(() => open('hello', MATCH, alice.pub, alice.pub, bob.secret), /Not an encrypted/);
});

test('both phones get the same safety number and creature order', () => {
  assert.deepEqual(safetyNumber(alice.pub, bob.pub), safetyNumber(bob.pub, alice.pub));
  assert.deepEqual(orderedPair(alice.pub, bob.pub), orderedPair(bob.pub, alice.pub));
  assert.equal(safetyNumber(alice.pub, bob.pub).join('').length, 30);
});

test('a swapped key changes the safety number', () => {
  assert.notDeepEqual(safetyNumber(alice.pub, bob.pub), safetyNumber(alice.pub, eve.pub));
});

test('a changed or removed key is flagged', () => {
  assert.equal(checkPin(null, bob.pub), 'new');
  assert.equal(checkPin(bob.pub, bob.pub), 'same');
  assert.equal(checkPin(bob.pub, eve.pub), 'changed');
  assert.equal(checkPin(bob.pub, null), 'changed');
});
